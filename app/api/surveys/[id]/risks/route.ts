// Survey risk register: list (GET) + generate/update/add/delete (POST). Qualitative, evidence-based.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { buildRisks, levelOf } from '@/lib/survey/risk';

function canUse(role_key: string | null, is_admin: boolean): boolean {
    if (is_admin) return true;
    const rk = (role_key || '').toLowerCase();
    return rk !== 'regular_client' && rk !== 'client';
}

async function list(surveyId: string) {
    const { data } = await supabaseAdmin.from('survey_risks').select('*').eq('survey_id', surveyId).order('sort_order');
    return { risks: data || [] };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canUse(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    return NextResponse.json(await list(id));
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
        const suggested = buildRisks(survey, assets || []);
        const { data: existing } = await supabaseAdmin.from('survey_risks').select('dimension, sort_order').eq('survey_id', id);
        const have = new Set((existing || []).map((r: any) => r.dimension));
        let order = (existing || []).reduce((m: number, r: any) => Math.max(m, r.sort_order || 0), 0);
        const rows = suggested.filter(s => !have.has(s.dimension)).map(s => ({
            survey_id: id, dimension: s.dimension, applicable: true, likelihood: s.likelihood, impact: s.impact,
            level: levelOf(s.likelihood, s.impact), basis: s.basis_ar, requires_approval: !!s.requires_approval,
            status: 'open', source: 'auto', sort_order: ++order,
        }));
        if (rows.length) { const { error } = await supabaseAdmin.from('survey_risks').insert(rows); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); }
        return NextResponse.json({ ...(await list(id)), added: rows.length });
    }

    if (b.action === 'update') {
        if (!b.riskId) return NextResponse.json({ error: 'riskId required' }, { status: 400 });
        const { data: cur } = await supabaseAdmin.from('survey_risks').select('*').eq('id', b.riskId).eq('survey_id', id).maybeSingle();
        if (!cur) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const patch: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const f of ['likelihood', 'impact', 'basis', 'evidence', 'mitigation', 'owner', 'residual', 'status']) if (f in b) patch[f] = b[f] || null;
        if ('applicable' in b) patch.applicable = !!b.applicable;
        if ('requires_approval' in b) patch.requires_approval = !!b.requires_approval;
        const likelihood = patch.likelihood ?? cur.likelihood;
        const impact = patch.impact ?? cur.impact;
        patch.level = levelOf(likelihood, impact);
        // a material (high/critical) risk can't be closed without a basis + mitigation recorded
        const closing = patch.status === 'mitigated' || patch.status === 'accepted';
        if (closing && (patch.level === 'high' || patch.level === 'critical')) {
            const basis = patch.basis ?? cur.basis; const mit = patch.mitigation ?? cur.mitigation;
            if (!basis || !mit) return NextResponse.json({ error: 'خطر مرتفع/حرج يتطلب تسجيل الأساس والتخفيف قبل إغلاقه / A high/critical risk needs a basis + mitigation before closing' }, { status: 400 });
        }
        const { error } = await supabaseAdmin.from('survey_risks').update(patch).eq('id', b.riskId).eq('survey_id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(await list(id));
    }

    if (b.action === 'add') {
        if (!b.dimension) return NextResponse.json({ error: 'dimension required' }, { status: 400 });
        const { data: existing } = await supabaseAdmin.from('survey_risks').select('sort_order').eq('survey_id', id);
        const order = (existing || []).reduce((m: number, r: any) => Math.max(m, r.sort_order || 0), 0) + 1;
        const { error } = await supabaseAdmin.from('survey_risks').insert({ survey_id: id, dimension: b.dimension, source: 'manual', status: 'open', sort_order: order });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(await list(id));
    }

    if (b.action === 'delete') {
        if (!b.riskId) return NextResponse.json({ error: 'riskId required' }, { status: 400 });
        const { error } = await supabaseAdmin.from('survey_risks').delete().eq('id', b.riskId).eq('survey_id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(await list(id));
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
