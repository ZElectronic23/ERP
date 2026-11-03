// Knowledge library — approved software catalog: search + create (editors only).
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { canEditKb, canApproveKb, KB_STATUSES, RESTRICTED_STATUSES } from '@/lib/survey/kbAuth';

export async function GET(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const u = new URL(request.url);
    const q = (u.searchParams.get('q') || '').trim();
    const os = u.searchParams.get('os');
    const status = u.searchParams.get('status');

    let query = supabaseAdmin.from('kb_software').select('*').is('deleted_at', null).order('name');
    if (status) query = query.eq('review_status', status);
    if (os) query = query.contains('supported_os', [os]);
    if (q) query = query.or(`name.ilike.%${q}%,publisher.ilike.%${q}%,purpose.ilike.%${q}%,licensing.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ software: data || [], canEdit: canEditKb(authed.profile.role_key, authed.profile.is_admin), canApprove: canApproveKb(authed.profile.role_key, authed.profile.is_admin) });
}

export async function POST(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { role_key, is_admin, entity_id, email } = authed.profile;
    if (!canEditKb(role_key, is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const b = await request.json().catch(() => ({}));
    if (!b?.name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    let review_status = KB_STATUSES.includes(b.review_status) ? b.review_status : 'draft';
    if (RESTRICTED_STATUSES.includes(review_status) && !canApproveKb(role_key, is_admin)) review_status = 'review';
    const commercial_use = ['allowed', 'restricted', 'unknown'].includes(b.commercial_use) ? b.commercial_use : 'unknown';

    const row = {
        name: b.name, publisher: b.publisher || null, purpose: b.purpose || null, official_source: b.official_source || null,
        supported_os: Array.isArray(b.supported_os) ? b.supported_os : [], supported_versions: b.supported_versions || null,
        approved_version: b.approved_version || null, install_instructions: b.install_instructions || null,
        portable_use: b.portable_use || null, licensing: b.licensing || null, commercial_use,
        admin_required: !!b.admin_required, security_review: b.security_review || null, limitations: b.limitations || null,
        difficulty: b.difficulty || null, pricing: b.pricing || null,
        verified_on: b.verified_on || null, review_status,
        change_log: [{ at: new Date().toISOString(), by: email, action: 'created', status: review_status }],
        created_by: entity_id, created_by_name: email,
    };
    const { data, error } = await supabaseAdmin.from('kb_software').insert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ software: data });
}
