// Phase 3: project business-journey. GET derives the stage from REAL linked records and returns
// the log + allowed next stage; POST advances (ordered, approval-gated) or syncs to the derived stage.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { STAGES, stageByKey, deriveStage, nextStages, isForwardSkip, orderOf, type JourneyFacts } from '@/lib/journey/stages';

function canUse(role_key: string | null, is_admin: boolean): boolean {
    if (is_admin) return true;
    const rk = (role_key || '').toLowerCase();
    return rk !== 'regular_client' && rk !== 'client';
}

async function gatherFacts(code: string): Promise<{ facts: JourneyFacts; project: any }> {
    const [proj, surveys, docs, contracts, procs, tasks] = await Promise.all([
        supabaseAdmin.from('projects').select('ProjectCode, Status, ApprovalStatus, ClientID').eq('ProjectCode', code).maybeSingle(),
        supabaseAdmin.from('tech_surveys').select('status').eq('project_code', code).is('deleted_at', null),
        supabaseAdmin.from('documents').select('doc_type, approval_status, payment_status, paid_amount, total').eq('project_id', code).is('deleted_at', null),
        supabaseAdmin.from('contracts').select('id, approval_status').eq('linked_project_code', code).is('deleted_at', null),
        supabaseAdmin.from('project_procurements').select('id').eq('project_code', code).is('deleted_at', null),
        supabaseAdmin.from('tasks').select('TaskID').eq('ProjectID', code),
    ]);
    const project = proj.data;
    const sv = surveys.data || [];
    const d = docs.data || [];
    const offers = d.filter((x: any) => x.doc_type === 'OF');
    const invoices = d.filter((x: any) => x.doc_type === 'IN');
    const st = String(project?.Status || '').toLowerCase();
    const facts: JourneyFacts = {
        hasClient: !!project?.ClientID,
        hasSurvey: sv.length > 0,
        surveyAssessed: sv.some((s: any) => ['submitted', 'reviewed', 'approved'].includes(s.status)),
        hasProject: !!project,
        hasOffer: offers.length > 0,
        internalApproved: project?.ApprovalStatus === 'approved' || offers.some((o: any) => o.approval_status === 'approved'),
        hasContract: (contracts.data || []).length > 0,
        hasPayment: d.some((x: any) => x.payment_status === 'paid' || Number(x.paid_amount) > 0),
        hasProcurement: (procs.data || []).length > 0,
        hasTasks: (tasks.data || []).length > 0,
        hasInvoice: invoices.length > 0,
        invoicePaid: invoices.some((x: any) => x.payment_status === 'paid' || Number(x.paid_amount) >= Number(x.total || 0) && Number(x.total) > 0),
        completed: /complet|closed|مكتمل|مغلق|منتهي/.test(st),
        hasEvaluation: false,
    };
    return { facts, project };
}

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canUse(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { code } = await params;

    const { facts, project } = await gatherFacts(code);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const derived = deriveStage(facts);
    const { data: proj } = await supabaseAdmin.from('projects').select('journey_stage').eq('ProjectCode', code).maybeSingle();
    const stored = proj?.journey_stage || null;
    const { data: log } = await supabaseAdmin.from('project_journey_log').select('*').eq('project_code', code).order('created_at', { ascending: false });

    // effective = furthest of stored vs derived (never regress the shown progress below real evidence)
    const effective = orderOf(stored) >= orderOf(derived) ? (stored || derived) : derived;
    return NextResponse.json({
        stages: STAGES, derived, stored, effective,
        next: nextStages(effective), facts, internalApproved: !!facts.internalApproved,
        log: log || [],
    });
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canUse(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { code } = await params;
    const b = await request.json().catch(() => ({}));

    const { facts, project } = await gatherFacts(code);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const who = authed.profile.email || null;
    const currentStored = project ? (await supabaseAdmin.from('projects').select('journey_stage').eq('ProjectCode', code).maybeSingle()).data?.journey_stage : null;

    if (b.action === 'sync') {
        const derived = deriveStage(facts);
        await supabaseAdmin.from('projects').update({ journey_stage: derived }).eq('ProjectCode', code);
        await supabaseAdmin.from('project_journey_log').insert({ project_code: code, from_stage: currentStored || null, to_stage: derived, actor: who, note: 'sync from records' });
        return NextResponse.json({ ok: true, stage: derived });
    }

    // manual advance
    const to = b.to;
    const target = stageByKey(to);
    if (!target) return NextResponse.json({ error: 'Unknown stage' }, { status: 400 });
    const from = currentStored || deriveStage(facts);
    if (isForwardSkip(from, to)) return NextResponse.json({ error: 'لا يمكن تخطّي أكثر من مرحلة للأمام / Cannot skip more than one stage forward' }, { status: 400 });
    // approval gate: advancing into a gated stage needs the project's approval cycle approved
    if (target.gate && orderOf(to) > orderOf(from) && !facts.internalApproved) {
        return NextResponse.json({ error: 'هذه المرحلة تتطلب اعتماداً داخلياً معتمداً أولاً / This stage requires an approved internal approval first' }, { status: 409 });
    }
    await supabaseAdmin.from('projects').update({ journey_stage: to }).eq('ProjectCode', code);
    await supabaseAdmin.from('project_journey_log').insert({ project_code: code, from_stage: from, to_stage: to, actor: who, note: b.note || null });
    return NextResponse.json({ ok: true, stage: to });
}
