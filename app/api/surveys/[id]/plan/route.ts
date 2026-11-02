// Phase 6: feed the EXISTING planning/quotation module from the survey.
// Generates DRAFT project_plan_items in the linked project. Costs/rates are left to the
// planning module (unit_cost = 0, flagged "needs approved pricing") — no invented rates.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';

function canUse(role_key: string | null, is_admin: boolean): boolean {
    if (is_admin) return true;
    const rk = (role_key || '').toLowerCase();
    return rk !== 'regular_client' && rk !== 'client';
}

const PRICING_NOTE = 'يحتاج تسعير معتمد من وحدة التخطيط';

function buildItems(survey: any, assets: any[], spares: any[], surveyNo: string) {
    const ans = survey.answers || {};
    const wt: string[] = survey.work_types || [];
    const items: any[] = [];
    const ref = (name: string, category: string, unit: string, opts: any = {}) =>
        items.push({ category, item_name: name, unit, quantity: 1, unit_cost: 0, sell_price: 0, is_essential: category !== 'material_complementary', item_type: 'survey', item_ref: surveyNo, notes: PRICING_NOTE, ...opts });

    // labor + visit (every executed survey needs field labor)
    ref(`عمالة فنية للتنفيذ (من المسح ${surveyNo})`, 'labor', 'ساعة');
    if (survey.site_location) ref('انتقالات وزيارة الموقع', 'labor', 'زيارة');

    // engineer/specialist when the survey flagged one
    const specialist = ans.findings?.specialist_required === true || ans.diagnostic_sequence?.specialist_needed === true;
    if (specialist || wt.includes('integration') || wt.includes('it_infra')) ref('مهندس/أخصائي فني', 'engineer', 'ساعة');

    // essential materials: recorded parts
    const parts = [ans.corrective_action?.parts_required, ans.maintenance_checks?.parts_replaced].filter(Boolean);
    parts.forEach((p: string) => ref(`قطعة غيار: ${p}`, 'material_essential', 'قطعة'));
    // spares flagged in the pre-visit checklist
    (spares || []).forEach((s: any) => ref(s.label_ar || 'قطعة غيار', 'material_essential', 'قطعة'));

    // consumables / cabling by work type
    if (wt.some(x => ['supply_install', 'it_infra', 'network'].includes(x))) ref('كابلات ووصلات ومعدات كهرباء', 'material_complementary', 'مجموعة');
    if (wt.includes('cctv')) ref('مستلزمات تركيب الكاميرات', 'material_complementary', 'مجموعة');

    return items;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canUse(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const { data: survey } = await supabaseAdmin.from('tech_surveys').select('project_code, survey_number').eq('id', id).is('deleted_at', null).maybeSingle();
    if (!survey) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    let generated = 0;
    if (survey.project_code) {
        const { count } = await supabaseAdmin.from('project_plan_items').select('id', { count: 'exact', head: true })
            .eq('project_code', survey.project_code).eq('item_type', 'survey').eq('item_ref', survey.survey_number).is('deleted_at', null);
        generated = count || 0;
    }
    return NextResponse.json({ project_code: survey.project_code, survey_number: survey.survey_number, generated });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canUse(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const b = await request.json().catch(() => ({}));
    if (b.action !== 'generate') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

    const { data: survey } = await supabaseAdmin.from('tech_surveys').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (!survey) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!survey.project_code) return NextResponse.json({ error: 'اربط المسح بمشروع قائم أولاً (بدون إنشاء مشروع مكرر) / Link the survey to an existing project first' }, { status: 400 });

    const { data: assets } = await supabaseAdmin.from('survey_assets').select('category, os_family').eq('survey_id', id);
    const { data: spares } = await supabaseAdmin.from('survey_checklist_items').select('label_ar').eq('survey_id', id).eq('kind', 'spare');
    const items = buildItems(survey, assets || [], spares || [], survey.survey_number);

    // idempotent: replace only THIS survey's previously generated draft items (never the planner's own)
    await supabaseAdmin.from('project_plan_items').delete()
        .eq('project_code', survey.project_code).eq('item_type', 'survey').eq('item_ref', survey.survey_number);

    const { data: existing } = await supabaseAdmin.from('project_plan_items').select('sort_order').eq('project_code', survey.project_code).is('deleted_at', null);
    let order = (existing || []).reduce((m: number, r: any) => Math.max(m, r.sort_order || 0), 0);
    const rows = items.map(it => ({ ...it, project_code: survey.project_code, sort_order: ++order }));
    const { error } = await supabaseAdmin.from('project_plan_items').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, project_code: survey.project_code, created: rows.length });
}
