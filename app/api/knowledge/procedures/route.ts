// Knowledge library — procedures: search (any signed-in user) + create (editors only).
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { canEditKb, canApproveKb, KB_STATUSES, RESTRICTED_STATUSES } from '@/lib/survey/kbAuth';

export async function GET(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const u = new URL(request.url);
    const q = (u.searchParams.get('q') || '').trim();
    const category = u.searchParams.get('category');
    const os = u.searchParams.get('os');
    const status = u.searchParams.get('status');
    const code = u.searchParams.get('code');

    let query = supabaseAdmin.from('kb_procedures').select('*').is('deleted_at', null).order('title_ar');
    if (code) query = query.eq('code', code);
    if (status) query = query.eq('review_status', status);
    if (category) query = query.contains('categories', [category]);
    if (os) query = query.contains('os_families', [os]);
    if (q) query = query.or(`title_ar.ilike.%${q}%,title_en.ilike.%${q}%,purpose.ilike.%${q}%,command.ilike.%${q}%,source.ilike.%${q}%,code.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ procedures: data || [], canEdit: canEditKb(authed.profile.role_key, authed.profile.is_admin), canApprove: canApproveKb(authed.profile.role_key, authed.profile.is_admin) });
}

export async function POST(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { role_key, is_admin, entity_id, email } = authed.profile;
    if (!canEditKb(role_key, is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const b = await request.json().catch(() => ({}));
    if (!b?.title_ar) return NextResponse.json({ error: 'title_ar required' }, { status: 400 });

    let review_status = KB_STATUSES.includes(b.review_status) ? b.review_status : 'draft';
    if (RESTRICTED_STATUSES.includes(review_status) && !canApproveKb(role_key, is_admin)) review_status = 'review';

    const row = {
        code: b.code || null, title_ar: b.title_ar, title_en: b.title_en || null, purpose: b.purpose || null,
        categories: Array.isArray(b.categories) ? b.categories : [], os_families: Array.isArray(b.os_families) ? b.os_families : [],
        models: b.models || null, os_versions: b.os_versions || null,
        required_software: b.required_software || null, required_equipment: b.required_equipment || null,
        instructions: b.instructions || null, command: b.command || null, tier: b.tier || null,
        environment: b.environment || null, privilege: b.privilege || 'none', prerequisites: b.prerequisites || null,
        expected: b.expected || null, interpretation: b.interpretation || null, limitations: b.limitations || null,
        impact: b.impact || 'none', data_loss_risk: !!b.data_loss_risk, qualification: b.qualification || null,
        est_minutes: b.est_minutes ? Number(b.est_minutes) : null, source: b.source || null,
        verified_on: b.verified_on || null, review_status,
        change_log: [{ at: new Date().toISOString(), by: email, action: 'created', status: review_status }],
        created_by: entity_id, created_by_name: email,
    };
    const { data, error } = await supabaseAdmin.from('kb_procedures').insert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ procedure: data });
}
