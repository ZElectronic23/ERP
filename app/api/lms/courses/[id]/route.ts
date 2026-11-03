// LMS — single course: detail (course + ordered lessons + my enrollment), edit + manage
// lessons (managers), soft-delete.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { canManageLms } from '../route';

async function myEmployee(email: string | null) {
    if (!email) return null;
    const { data } = await supabaseAdmin.from('employees').select('EmployeeID, Name, Department').eq('WorkEmail', email).maybeSingle();
    return data;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const canManage = canManageLms(authed.profile.role_key, authed.profile.is_admin);
    const emp = await myEmployee(authed.profile.email);

    const { data: course } = await supabaseAdmin.from('courses').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (course.status !== 'published' && !canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: lessons } = await supabaseAdmin.from('lessons').select('*').eq('course_id', id).order('sort_order');
    let enrollment = null;
    if (emp) {
        const { data } = await supabaseAdmin.from('course_enrollments').select('*').eq('course_id', id).eq('employee_id', emp.EmployeeID).maybeSingle();
        enrollment = data;
    }
    return NextResponse.json({ course, lessons: lessons || [], enrollment, canManage, me: emp ? emp.EmployeeID : null });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageLms(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const b = await request.json().catch(() => ({}));

    // lesson management actions
    if (b.action === 'add_lesson' || b.action === 'update_lesson') {
        const l = b.lesson || {};
        const row: Record<string, any> = {
            course_id: id, title_ar: l.title_ar || 'درس', title_en: l.title_en || null,
            kind: ['video', 'text', 'quiz'].includes(l.kind) ? l.kind : 'text', video_url: l.video_url || null,
            content: l.content || null, duration_minutes: l.duration_minutes ? Number(l.duration_minutes) : null,
            quiz: Array.isArray(l.quiz) ? l.quiz : [], sort_order: Number(l.sort_order) || 0,
            subtitles: l.subtitles || null, subtitles_lang: l.subtitles_lang || null,
        };
        if (b.action === 'add_lesson') { const { data, error } = await supabaseAdmin.from('lessons').insert(row).select().single(); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); return NextResponse.json({ lesson: data }); }
        const { error } = await supabaseAdmin.from('lessons').update(row).eq('id', l.id).eq('course_id', id); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); return NextResponse.json({ ok: true });
    }
    if (b.action === 'delete_lesson') {
        await supabaseAdmin.from('lessons').delete().eq('id', String(b.lesson_id || '')).eq('course_id', id);
        return NextResponse.json({ ok: true });
    }

    // edit course fields
    const EDITABLE = ['title_ar', 'title_en', 'provider', 'description', 'department', 'skill', 'difficulty', 'duration_minutes', 'prerequisites', 'instructor', 'objectives', 'outcomes', 'assessment', 'external_url', 'cover_emoji', 'status', 'pricing'];
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const f of EDITABLE) if (f in b) patch[f] = b[f] === '' ? null : b[f];
    if ('has_subtitles' in b) patch.has_subtitles = !!b.has_subtitles;
    if ('certificate' in b) patch.certificate = !!b.certificate;
    for (const a of ['positions', 'skill_tags', 'languages']) if (Array.isArray(b[a])) patch[a] = b[a].filter(Boolean).map((x: any) => String(x));
    if ('duration_minutes' in b) patch.duration_minutes = b.duration_minutes ? Number(b.duration_minutes) : null;
    const { error } = await supabaseAdmin.from('courses').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageLms(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    await supabaseAdmin.from('courses').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ ok: true });
}
