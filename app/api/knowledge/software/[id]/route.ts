// Knowledge library — software update/soft-delete (editors only; approve/suspend = managers+).
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { canEditKb, canApproveKb, KB_STATUSES, RESTRICTED_STATUSES } from '@/lib/survey/kbAuth';

const EDITABLE = ['name', 'publisher', 'purpose', 'official_source', 'supported_versions', 'approved_version',
    'install_instructions', 'portable_use', 'licensing', 'security_review', 'limitations', 'verified_on',
    'difficulty', 'pricing'];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { role_key, is_admin, email } = authed.profile;
    if (!canEditKb(role_key, is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;

    const { data: existing } = await supabaseAdmin.from('kb_software').select('version, change_log').eq('id', id).is('deleted_at', null).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const b = await request.json().catch(() => ({}));
    const patch: Record<string, any> = { updated_at: new Date().toISOString(), updated_by_name: email, version: (existing.version || 1) + 1 };
    for (const f of EDITABLE) if (f in b) patch[f] = b[f] === '' ? null : b[f];
    if ('admin_required' in b) patch.admin_required = !!b.admin_required;
    if (Array.isArray(b.supported_os)) patch.supported_os = b.supported_os;
    if ('commercial_use' in b && ['allowed', 'restricted', 'unknown'].includes(b.commercial_use)) patch.commercial_use = b.commercial_use;

    let statusNote = 'edited';
    if ('review_status' in b && KB_STATUSES.includes(b.review_status)) {
        if (RESTRICTED_STATUSES.includes(b.review_status) && !canApproveKb(role_key, is_admin)) {
            return NextResponse.json({ error: 'Only a manager/admin can approve or suspend.' }, { status: 403 });
        }
        patch.review_status = b.review_status;
        statusNote = `status → ${b.review_status}`;
    }
    const log = Array.isArray(existing.change_log) ? existing.change_log : [];
    patch.change_log = [...log, { at: patch.updated_at, by: email, action: statusNote, version: patch.version }];

    const { data, error } = await supabaseAdmin.from('kb_software').update(patch).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ software: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canEditKb(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const { error } = await supabaseAdmin.from('kb_software').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
