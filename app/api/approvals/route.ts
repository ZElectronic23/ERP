// app/api/approvals/route.ts — server-enforced approval engine.
// All decisions record the server-verified approver identity; rejections require a reason;
// duplicate / out-of-order / self-approval attempts are blocked; every decision is audited.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { logAudit } from '@/lib/audit/log';
import { canDecide } from '@/lib/approvals/roles';

type EntityType = 'document' | 'contract' | 'project' | 'leave' | 'procurement' | 'expense' | 'survey_gate';
const ENTITY: Record<EntityType, { table: string; pk: string; col: string }> = {
    document: { table: 'documents', pk: 'id', col: 'approval_status' },
    contract: { table: 'contracts', pk: 'id', col: 'approval_status' },
    project: { table: 'projects', pk: 'ProjectCode', col: 'ApprovalStatus' },
    leave: { table: 'leave_requests', pk: 'id', col: 'approval_status' },
    procurement: { table: 'project_procurements', pk: 'id', col: 'approval_status' },
    expense: { table: 'expenses', pk: 'ExpenseID', col: 'approval_status' },
    survey_gate: { table: 'survey_gates', pk: 'id', col: 'approval_status' },   // Phase 5 approval gates
};

const DEFAULT_STEPS = [
    { ar: 'مراجعة فنية', role: 'reviewer' },
    { ar: 'مراجعة مالية', role: 'finance' },
    { ar: 'الاعتماد النهائي', role: 'ceo' },
];

// pick the configured route (highest min_value that the value meets) or fall back to the default chain
async function routeSteps(entityType: string, value: number): Promise<{ ar: string; role: string | null }[]> {
    const { data } = await supabaseAdmin.from('approval_routes').select('steps, min_value')
        .eq('entity_type', entityType).eq('active', true).lte('min_value', value || 0)
        .order('min_value', { ascending: false }).limit(1);
    const steps = data?.[0]?.steps;
    if (Array.isArray(steps) && steps.length) return steps.map((s: any) => ({ ar: s.ar || s.en || 'خطوة', role: s.role || null }));
    return DEFAULT_STEPS;
}

// run module-specific side effects when a request's cycle reaches a final state
async function applyOutcome(entityType: string, entityId: string, finalStatus: string) {
    if (finalStatus === 'approved') {
        if (entityType === 'leave') {
            const { data: lv } = await supabaseAdmin.from('leave_requests').select('*').eq('id', entityId).maybeSingle();
            if (lv) {
                await supabaseAdmin.from('leave_requests').update({ status: 'approved' }).eq('id', entityId);
                if (lv.leave_type === 'annual' && lv.employee_id) {
                    const { data: emp } = await supabaseAdmin.from('employees').select('LeaveBalance').eq('EmployeeID', lv.employee_id).maybeSingle();
                    if (emp) await supabaseAdmin.from('employees').update({ LeaveBalance: (Number(emp.LeaveBalance) || 0) - (Number(lv.days) || 0) }).eq('EmployeeID', lv.employee_id);
                }
            }
        } else if (entityType === 'procurement') {
            await supabaseAdmin.from('project_procurements').update({ status: 'approved' }).eq('id', entityId);
        } else if (entityType === 'expense') {
            await supabaseAdmin.from('expenses').update({ Status: 'paid' }).eq('ExpenseID', entityId); // triggers auto-posting
        }
    } else if (finalStatus === 'rejected') {
        if (entityType === 'leave') await supabaseAdmin.from('leave_requests').update({ status: 'rejected' }).eq('id', entityId);
        else if (entityType === 'procurement') await supabaseAdmin.from('project_procurements').update({ status: 'rejected' }).eq('id', entityId);
        else if (entityType === 'expense') await supabaseAdmin.from('expenses').update({ Status: 'rejected' }).eq('ExpenseID', entityId);
    }
}

async function fullName(entityId: string): Promise<string> {
    const { data } = await supabaseAdmin.from('users').select('full_name, email').eq('entity_id', entityId).maybeSingle();
    return data?.full_name || data?.email || '';
}

function overall(rows: { status: string }[]): string {
    if (rows.length === 0) return 'draft';
    if (rows.some(r => r.status === 'rejected')) return 'rejected';
    if (rows.every(r => r.status === 'approved')) return 'approved';
    return 'in_review';
}

async function syncEntity(entityType: EntityType, entityId: string, status: string) {
    const m = ENTITY[entityType];
    await supabaseAdmin.from(m.table).update({ [m.col]: status }).eq(m.pk, entityId);
}

// POST — start an approval cycle for an entity
export async function POST(req: NextRequest) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { entityType, entityId, value } = await req.json();
        if (!ENTITY[entityType as EntityType] || !entityId) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

        const { data: existing } = await supabaseAdmin.from('approvals').select('id').eq('entity_type', entityType).eq('entity_id', entityId).limit(1);
        if (existing && existing.length) return NextResponse.json({ error: 'Cycle already started' }, { status: 409 });

        const name = await fullName(authed.profile.entity_id);
        const chain = await routeSteps(entityType, Number(value) || 0);
        const rows = chain.map((s, i) => ({
            entity_type: entityType, entity_id: entityId, step_order: i + 1, title: s.ar, required_role: s.role || null,
            status: 'pending', cycle: 1, requested_by: authed.profile.entity_id, requested_by_name: name,
        }));
        const { error } = await supabaseAdmin.from('approvals').insert(rows);
        if (error) throw error;
        await syncEntity(entityType, entityId, 'in_review');
        await logAudit({ tableName: 'approvals', recordId: entityId, action: 'INSERT', newData: { entityType, started_by: authed.profile.entity_id }, userId: authed.profile.entity_id });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// PATCH — record a decision (approve / reject) on a step
export async function PATCH(req: NextRequest) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { id, decision, reason } = await req.json();
        if (decision !== 'approved' && decision !== 'rejected') return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
        if (decision === 'rejected' && (!reason || !String(reason).trim())) {
            return NextResponse.json({ error: 'سبب الرفض مطلوب / Rejection reason is required' }, { status: 400 });
        }

        const { data: step } = await supabaseAdmin.from('approvals').select('*').eq('id', id).maybeSingle();
        if (!step) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (step.status !== 'pending') return NextResponse.json({ error: 'تم اتخاذ القرار بالفعل / Already decided' }, { status: 409 });

        // separation of duties: the requester cannot approve their own request
        if (step.requested_by && step.requested_by === authed.profile.entity_id) {
            return NextResponse.json({ error: 'لا يمكنك اعتماد طلبك بنفسك / You cannot approve your own request' }, { status: 403 });
        }

        // role-based routing: the decider must hold the role this step requires (CEO/admin may override)
        if (!canDecide(step.required_role || null, authed.profile.role_key, authed.profile.is_admin)) {
            return NextResponse.json({ error: `هذه الخطوة تتطلب صلاحية «${step.required_role}» / This step requires the "${step.required_role}" role` }, { status: 403 });
        }

        // sequential: this must be the earliest still-pending step
        const { data: siblings } = await supabaseAdmin.from('approvals').select('id, step_order, status')
            .eq('entity_type', step.entity_type).eq('entity_id', step.entity_id).eq('cycle', step.cycle).order('step_order');
        const firstPending = (siblings || []).find(s => s.status === 'pending');
        if (!firstPending || firstPending.id !== id) {
            return NextResponse.json({ error: 'يجب اعتماد الخطوات بالترتيب / Approve steps in order' }, { status: 409 });
        }

        const name = await fullName(authed.profile.entity_id);
        // atomic guard against duplicate/concurrent: only update while still pending
        const { data: updated, error: upErr } = await supabaseAdmin.from('approvals')
            .update({ status: decision, approver_id: authed.profile.entity_id, approver_name: name, approver_position: authed.profile.role_key || null, note: decision === 'rejected' ? String(reason).trim() : (reason ? String(reason).trim() : null), acted_at: new Date().toISOString() })
            .eq('id', id).eq('status', 'pending').select();
        if (upErr) throw upErr;
        if (!updated || updated.length === 0) return NextResponse.json({ error: 'Already decided' }, { status: 409 });

        // recompute overall status
        const { data: allRows } = await supabaseAdmin.from('approvals').select('status')
            .eq('entity_type', step.entity_type).eq('entity_id', step.entity_id).eq('cycle', step.cycle);
        const status = overall(allRows || []);
        await syncEntity(step.entity_type, step.entity_id, status);
        // module-specific side effects when the cycle reaches a final state
        if (status === 'approved' || status === 'rejected') {
            await applyOutcome(step.entity_type, step.entity_id, status);
        }

        // notify the requester
        if (step.requested_by) {
            const msg = decision === 'rejected'
                ? `تم رفض طلبك في خطوة «${step.title}» بواسطة ${name}. السبب: ${String(reason).trim()}`
                : status === 'approved'
                    ? `تم اعتماد طلبك بالكامل ✓ (آخر خطوة بواسطة ${name})`
                    : `تم اعتماد خطوة «${step.title}» بواسطة ${name}. بانتظار الخطوة التالية.`;
            await supabaseAdmin.from('notifications').insert({
                user_id: step.requested_by, title: 'تحديث على الاعتماد',
                message: msg, type: decision === 'rejected' ? 'error' : 'success', is_read: false,
            });
        }

        await logAudit({ tableName: 'approvals', recordId: id, action: 'UPDATE', newData: { decision, step: step.title, approver: authed.profile.entity_id, reason: reason || null }, userId: authed.profile.entity_id });
        return NextResponse.json({ ok: true, status });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// GET — list the steps for an entity (read-only; RLS also allows authenticated SELECT)
export async function GET(req: NextRequest) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    if (!entityType || !entityId) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    const { data } = await supabaseAdmin.from('approvals').select('*').eq('entity_type', entityType).eq('entity_id', entityId).order('step_order');
    return NextResponse.json({ steps: data || [] });
}
