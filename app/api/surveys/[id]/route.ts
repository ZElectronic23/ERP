// Single survey: read (with assets), save/resume + submit, soft-delete.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { computeProgress } from '@/lib/survey/catalog';

function canUse(role_key: string | null, is_admin: boolean): boolean {
    if (is_admin) return true;
    const rk = (role_key || '').toLowerCase();
    return rk !== 'regular_client' && rk !== 'client';
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canUse(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;

    const { data: survey, error } = await supabaseAdmin.from('tech_surveys').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!survey) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { data: assets } = await supabaseAdmin.from('survey_assets').select('*').eq('survey_id', id).order('sort_order');
    return NextResponse.json({ survey, assets: assets || [] });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canUse(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;

    const { data: existing } = await supabaseAdmin.from('tech_surveys').select('work_types, answers').eq('id', id).is('deleted_at', null).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));

    // Clearance gate: marking a survey "approved" (cleared to proceed) needs manager/admin authority
    // AND every triggered approval gate satisfied (approved through the engine, or waived).
    if (body.status === 'approved') {
        const rk = (authed.profile.role_key || '').toLowerCase();
        const canClear = authed.profile.is_admin || rk === 'ceo' || rk.includes('manager');
        if (!canClear) return NextResponse.json({ error: 'اعتماد جاهزية المسح للمدير/الأدمن فقط / Clearing a survey is manager/admin only' }, { status: 403 });
        const { data: gates } = await supabaseAdmin.from('survey_gates').select('gate_type, approval_status, waived').eq('survey_id', id);
        const blocking = (gates || []).filter((g: any) => !(g.waived === true || g.approval_status === 'approved'));
        if (blocking.length) return NextResponse.json({ error: 'لا يمكن اعتماد المسح قبل استيفاء بوابات الاعتماد: ' + blocking.map((g: any) => g.gate_type).join('، '), blocking: blocking.map((g: any) => g.gate_type) }, { status: 409 });
    }

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    const fields = ['title', 'project_code', 'client_id', 'site_location', 'site_contact', 'scheduled_at', 'status'];
    for (const f of fields) if (f in body) patch[f] = body[f] || null;

    const work_types: string[] = Array.isArray(body?.work_types) ? body.work_types : (existing.work_types || []);
    const answers = body?.answers && typeof body.answers === 'object' ? body.answers : (existing.answers || {});
    if ('work_types' in body) patch.work_types = work_types;
    if ('answers' in body) patch.answers = answers;
    patch.progress = computeProgress(work_types, answers);

    const { data: survey, error } = await supabaseAdmin.from('tech_surveys').update(patch).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // optional full replace of the asset list
    if (Array.isArray(body?.assets)) {
        await supabaseAdmin.from('survey_assets').delete().eq('survey_id', id);
        const rows = body.assets.map((a: any, i: number) => ({
            survey_id: id,
            category: a.category || 'other',
            subcategory: a.subcategory || null,
            manufacturer: a.manufacturer || null,
            model: a.model || null,
            os_family: a.os_family || null,
            os_version: a.os_version || null,
            serial: a.serial || null,
            asset_condition: a.asset_condition || null,
            notes: a.notes || null,
            diagnostics: a.diagnostics && typeof a.diagnostics === 'object' ? a.diagnostics : {},
            sort_order: i,
        }));
        if (rows.length) await supabaseAdmin.from('survey_assets').insert(rows);
    }
    return NextResponse.json({ survey });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canUse(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const { error } = await supabaseAdmin.from('tech_surveys').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
