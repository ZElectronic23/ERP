// Survey approval gates: list + clearance (GET), generate/waive (POST).
// The actual sign-off runs through the shared approvals engine (entity_type 'survey_gate'),
// embedded via ApprovalPanel; a gate is satisfied when its cycle is approved or a manager waives it.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { buildGates } from '@/lib/survey/risk';

function canUse(role_key: string | null, is_admin: boolean): boolean {
    if (is_admin) return true;
    const rk = (role_key || '').toLowerCase();
    return rk !== 'regular_client' && rk !== 'client';
}
function canManage(role_key: string | null, is_admin: boolean): boolean {
    if (is_admin) return true;
    const rk = (role_key || '').toLowerCase();
    return rk === 'ceo' || rk.includes('manager');
}

function decorate(gates: any[]) {
    const g = gates.map(x => {
        const satisfied = x.waived === true || x.approval_status === 'approved';
        const rejected = x.approval_status === 'rejected';
        return { ...x, satisfied, rejected, blocking: !satisfied };
    });
    const blocking = g.filter(x => x.blocking).length;
    return { gates: g, clearance: { blocking, cleared: blocking === 0 && g.length >= 0 } };
}

async function list(surveyId: string) {
    const { data } = await supabaseAdmin.from('survey_gates').select('*').eq('survey_id', surveyId).order('created_at');
    return decorate(data || []);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canUse(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const r = await list(id);
    return NextResponse.json({ ...r, canManage: canManage(authed.profile.role_key, authed.profile.is_admin) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canUse(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const b = await request.json().catch(() => ({}));

    if (b.action === 'generate') {
        const { data: survey } = await supabaseAdmin.from('tech_surveys').select('work_types, answers').eq('id', id).is('deleted_at', null).maybeSingle();
        if (!survey) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const { data: assets } = await supabaseAdmin.from('survey_assets').select('category, os_family').eq('survey_id', id);
        const suggested = buildGates(survey, assets || []);
        const { data: existing } = await supabaseAdmin.from('survey_gates').select('gate_type').eq('survey_id', id);
        const have = new Set((existing || []).map((r: any) => r.gate_type));
        const rows = suggested.filter(s => !have.has(s.gate_type)).map(s => ({
            survey_id: id, gate_type: s.gate_type, reason: s.reason_ar, required_role: s.required_role, approval_status: 'draft',
        }));
        if (rows.length) { const { error } = await supabaseAdmin.from('survey_gates').insert(rows); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); }
        return NextResponse.json({ ...(await list(id)), added: rows.length });
    }

    if (b.action === 'waive') {
        if (!canManage(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'الإعفاء من البوابة للمدير/الأدمن فقط / Waiving a gate is manager/admin only' }, { status: 403 });
        if (!b.gateId || !String(b.reason || '').trim()) return NextResponse.json({ error: 'سبب الإعفاء مطلوب / A waive reason is required' }, { status: 400 });
        const { error } = await supabaseAdmin.from('survey_gates').update({ waived: true, waived_reason: String(b.reason).trim(), waived_by_name: authed.profile.email || null, updated_at: new Date().toISOString() }).eq('id', b.gateId).eq('survey_id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(await list(id));
    }

    if (b.action === 'unwaive') {
        if (!canManage(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { error } = await supabaseAdmin.from('survey_gates').update({ waived: false, waived_reason: null, waived_by_name: null, updated_at: new Date().toISOString() }).eq('id', b.gateId).eq('survey_id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(await list(id));
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
