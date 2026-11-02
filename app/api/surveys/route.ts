// Universal Technical Survey API — list + create. All writes via service role; authz server-side.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { computeProgress } from '@/lib/survey/catalog';

// A survey is operational data for the projects/maintenance side.
function canUse(role_key: string | null, is_admin: boolean): boolean {
    if (is_admin) return true;
    const rk = (role_key || '').toLowerCase();
    return rk !== 'regular_client' && rk !== 'client';
}

export async function GET(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { role_key, is_admin } = authed.profile;
    if (!canUse(role_key, is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    let q = supabaseAdmin.from('tech_surveys').select('*').is('deleted_at', null).order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ surveys: data || [] });
}

export async function POST(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { entity_id, role_key, is_admin } = authed.profile;
    if (!canUse(role_key, is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const work_types: string[] = Array.isArray(body?.work_types) ? body.work_types : [];
    const answers = body?.answers && typeof body.answers === 'object' ? body.answers : {};

    // survey number: TS-YYYY-#### (sequential within the year)
    const year = new Date().getFullYear();
    const { count } = await supabaseAdmin.from('tech_surveys').select('id', { count: 'exact', head: true })
        .gte('created_at', `${year}-01-01`);
    const survey_number = `TS-${year}-${String((count || 0) + 1).padStart(4, '0')}`;

    const row = {
        survey_number,
        title: body?.title || null,
        project_code: body?.project_code || null,
        client_id: body?.client_id || null,
        work_types,
        answers,
        site_location: body?.site_location || null,
        site_contact: body?.site_contact || null,
        scheduled_at: body?.scheduled_at || null,
        status: 'draft',
        progress: computeProgress(work_types, answers),
        created_by: entity_id,
        created_by_name: authed.profile.email || null,
    };
    const { data, error } = await supabaseAdmin.from('tech_surveys').insert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ survey: data });
}
