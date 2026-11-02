// Pre-visit checklist for a survey: list + readiness (GET), and generate/add/update/delete (POST).
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { buildChecklist, computeReadiness, ITEM_STATUSES } from '@/lib/survey/checklist';

function canUse(role_key: string | null, is_admin: boolean): boolean {
    if (is_admin) return true;
    const rk = (role_key || '').toLowerCase();
    return rk !== 'regular_client' && rk !== 'client';
}

async function listItems(surveyId: string) {
    const { data } = await supabaseAdmin.from('survey_checklist_items').select('*').eq('survey_id', surveyId).order('sort_order');
    const items = data || [];
    return { items, readiness: computeReadiness(items) };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canUse(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    return NextResponse.json(await listItems(id));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canUse(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const b = await request.json().catch(() => ({}));
    const action = b?.action;

    if (action === 'generate') {
        // read the SAVED survey + assets and derive only the applicable items
        const { data: survey } = await supabaseAdmin.from('tech_surveys').select('work_types, answers, project_code').eq('id', id).is('deleted_at', null).maybeSingle();
        if (!survey) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const { data: assets } = await supabaseAdmin.from('survey_assets').select('category, os_family').eq('survey_id', id);
        const suggested = buildChecklist(survey, assets || []);

        const { data: existing } = await supabaseAdmin.from('survey_checklist_items').select('item_key, sort_order').eq('survey_id', id);
        const have = new Set((existing || []).map((r: any) => r.item_key).filter(Boolean));
        let order = (existing || []).reduce((m: number, r: any) => Math.max(m, r.sort_order || 0), 0);
        const toInsert = suggested.filter(s => !have.has(s.item_key)).map(s => ({
            survey_id: id, item_key: s.item_key, kind: s.kind, label_ar: s.label_ar, label_en: s.label_en,
            detail: s.detail || null, critical: !!s.critical, remote_possible: !!s.remote_possible,
            status: s.status || 'required', source: 'auto', sort_order: ++order,
        }));
        if (toInsert.length) {
            const { error } = await supabaseAdmin.from('survey_checklist_items').insert(toInsert);
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ ...(await listItems(id)), added: toInsert.length });
    }

    if (action === 'add') {
        const it = b.item || {};
        if (!it.label_ar) return NextResponse.json({ error: 'label_ar required' }, { status: 400 });
        const { data: existing } = await supabaseAdmin.from('survey_checklist_items').select('sort_order').eq('survey_id', id);
        const order = (existing || []).reduce((m: number, r: any) => Math.max(m, r.sort_order || 0), 0) + 1;
        const { error } = await supabaseAdmin.from('survey_checklist_items').insert({
            survey_id: id, item_key: null, kind: it.kind || 'other', label_ar: it.label_ar, label_en: it.label_en || null,
            detail: it.detail || null, critical: !!it.critical, remote_possible: !!it.remote_possible,
            status: 'required', source: 'manual', sort_order: order,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(await listItems(id));
    }

    if (action === 'update') {
        if (!b.itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });
        const patch: Record<string, any> = {};
        if ('status' in b && ITEM_STATUSES.includes(b.status)) patch.status = b.status;
        if ('note' in b) patch.note = b.note || null;
        if ('critical' in b) patch.critical = !!b.critical;
        const { error } = await supabaseAdmin.from('survey_checklist_items').update(patch).eq('id', b.itemId).eq('survey_id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(await listItems(id));
    }

    if (action === 'delete') {
        if (!b.itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });
        const { error } = await supabaseAdmin.from('survey_checklist_items').delete().eq('id', b.itemId).eq('survey_id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(await listItems(id));
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
