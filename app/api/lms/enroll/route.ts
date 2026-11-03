// LMS — enrollment & progress for the signed-in employee. Progress is driven by completed
// lessons; a final assessment score gates "completed" (a passing score is required — finishing
// the videos alone is not completion). Competency updates stay a separate, manager-validated step.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';

const PASS_MARK = 60; // percent

async function myEmployee(email: string | null) {
    if (!email) return null;
    const { data } = await supabaseAdmin.from('employees').select('EmployeeID, Name').eq('WorkEmail', email).maybeSingle();
    return data;
}

export async function POST(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const emp = await myEmployee(authed.profile.email);
    if (!emp) return NextResponse.json({ error: 'no_employee', message: 'لا يوجد ملف موظف مرتبط بحسابك.' }, { status: 404 });
    const b = await request.json().catch(() => ({}));
    const course_id = String(b.course_id || '');
    if (!course_id) return NextResponse.json({ error: 'course_id required' }, { status: 400 });

    if (b.action === 'unenroll') {
        await supabaseAdmin.from('course_enrollments').delete().eq('course_id', course_id).eq('employee_id', emp.EmployeeID);
        return NextResponse.json({ ok: true });
    }
    // enroll (idempotent)
    const { data, error } = await supabaseAdmin.from('course_enrollments')
        .upsert({ course_id, employee_id: emp.EmployeeID, status: 'enrolled', updated_at: new Date().toISOString() }, { onConflict: 'course_id,employee_id', ignoreDuplicates: true })
        .select().maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, enrollment: data });
}

export async function PATCH(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const emp = await myEmployee(authed.profile.email);
    if (!emp) return NextResponse.json({ error: 'no_employee' }, { status: 404 });
    const b = await request.json().catch(() => ({}));
    const course_id = String(b.course_id || '');
    if (!course_id) return NextResponse.json({ error: 'course_id required' }, { status: 400 });

    const { data: enr } = await supabaseAdmin.from('course_enrollments').select('*').eq('course_id', course_id).eq('employee_id', emp.EmployeeID).maybeSingle();
    if (!enr) return NextResponse.json({ error: 'not_enrolled', message: 'سجّل في الكورس أولاً.' }, { status: 400 });

    const { count: totalLessons } = await supabaseAdmin.from('lessons').select('id', { count: 'exact', head: true }).eq('course_id', course_id);

    if (b.action === 'complete_lesson') {
        const lid = String(b.lesson_id || '');
        const done: string[] = Array.isArray(enr.completed_lessons) ? enr.completed_lessons : [];
        if (lid && !done.includes(lid)) done.push(lid);
        const total = totalLessons || 0;
        const pct = total > 0 ? Math.round((done.length / total) * 100) : 0;
        const status = pct >= 100 ? (enr.assessment_passed ? 'completed' : 'in_progress') : (pct > 0 ? 'in_progress' : 'enrolled');
        await supabaseAdmin.from('course_enrollments').update({ completed_lessons: done, progress_pct: pct, status, updated_at: new Date().toISOString() }).eq('id', enr.id);
        return NextResponse.json({ ok: true, progress_pct: pct });
    }

    if (b.action === 'submit_assessment') {
        const score = Math.max(0, Math.min(100, Number(b.score) || 0));
        const passed = score >= PASS_MARK;
        const done: string[] = Array.isArray(enr.completed_lessons) ? enr.completed_lessons : [];
        const total = totalLessons || 0;
        const lessonsDone = total === 0 || done.length >= total;
        const status = passed && lessonsDone ? 'completed' : 'in_progress';
        await supabaseAdmin.from('course_enrollments').update({
            final_score: score, assessment_passed: passed, status,
            completed_at: status === 'completed' ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
        }).eq('id', enr.id);
        return NextResponse.json({ ok: true, score, passed, pass_mark: PASS_MARK, completed: status === 'completed' });
    }

    return NextResponse.json({ error: 'bad_action' }, { status: 400 });
}
