// Competency management — skills, levels, certifications and staffing intelligence.
// Principles: a course completion does NOT auto-promote anyone to "expert"; skills gained from
// courses land as PENDING and need manager validation. Staffing suggestions are advisory only —
// a human approves every assignment. Each employee sees their own profile; managers/HR see all.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';

const FULL = ['ceo', 'admin', 'general_manager'];
const MGR = ['hrd', 'hr', 'manager', 'pm', 'project_manager'];
const canValidate = (role?: string | null, isAdmin?: boolean | null) => {
    const rk = (role || '').toLowerCase(); return !!isAdmin || FULL.includes(rk) || MGR.includes(rk);
};

async function myEmployee(email: string | null) {
    if (!email) return null;
    const { data } = await supabaseAdmin.from('employees').select('EmployeeID, Name, Department, Position, DirectManagerID, StartDate, CurrentProjects').eq('WorkEmail', email).maybeSingle();
    return data;
}
async function openTaskCount(empId: string) {
    const { count } = await supabaseAdmin.from('tasks').select('TaskID', { count: 'exact', head: true }).eq('EmployeeID', empId).is('deleted_at', null).neq('Status', 'done');
    return count || 0;
}

export async function GET(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const mgr = canValidate(authed.profile.role_key, authed.profile.is_admin);
    const me = await myEmployee(authed.profile.email);
    const u = new URL(request.url);

    // manager team overview
    if (u.searchParams.get('team') === '1') {
        if (!mgr) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { data: emps } = await supabaseAdmin.from('employees').select('EmployeeID, Name, Department, Position').is('deleted_at', null).order('Name');
        const { data: skills } = await supabaseAdmin.from('employee_skills').select('employee_id, validated');
        const byEmp: Record<string, { total: number; validated: number; pending: number }> = {};
        for (const s of skills || []) { const b = (byEmp[s.employee_id] ||= { total: 0, validated: 0, pending: 0 }); b.total++; s.validated ? b.validated++ : b.pending++; }
        return NextResponse.json({ canValidate: true, team: (emps || []).map((e: any) => ({ ...e, skills: byEmp[e.EmployeeID] || { total: 0, validated: 0, pending: 0 } })) });
    }

    // a profile (mine by default; a manager may request anyone's)
    let target = me;
    const reqId = u.searchParams.get('employee_id');
    if (reqId && reqId !== me?.EmployeeID) {
        if (!mgr) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { data } = await supabaseAdmin.from('employees').select('EmployeeID, Name, Department, Position, DirectManagerID, StartDate, CurrentProjects').eq('EmployeeID', reqId).maybeSingle();
        target = data;
    }
    // No linked employee record: still report canValidate so managers keep Team/Staffing access.
    if (!target) return NextResponse.json({ canValidate: mgr, isSelf: true, employee: null, skills: [], certifications: [], completedCourses: [], openTasks: 0 });

    const [{ data: skills }, { data: certs }, { data: enrollments }] = await Promise.all([
        supabaseAdmin.from('employee_skills').select('*').eq('employee_id', target.EmployeeID).order('skill'),
        supabaseAdmin.from('employee_certifications').select('*').eq('employee_id', target.EmployeeID).order('issued_on', { ascending: false }),
        supabaseAdmin.from('course_enrollments').select('course_id, status, assessment_passed, final_score, completed_at').eq('employee_id', target.EmployeeID),
    ]);
    // completed courses (with titles) as evidence
    const courseIds = (enrollments || []).map((e: any) => e.course_id);
    let courses: any[] = [];
    if (courseIds.length) { const { data } = await supabaseAdmin.from('courses').select('id, title_ar, title_en, skill').in('id', courseIds); courses = data || []; }
    const courseMap: Record<string, any> = {}; for (const c of courses) courseMap[c.id] = c;
    const completedCourses = (enrollments || []).filter((e: any) => e.status === 'completed').map((e: any) => ({ ...e, course: courseMap[e.course_id] || null }));
    const openTasks = await openTaskCount(target.EmployeeID);

    return NextResponse.json({
        canValidate: mgr, isSelf: target.EmployeeID === me?.EmployeeID,
        employee: target, skills: skills || [], certifications: certs || [],
        completedCourses, openTasks,
    });
}

export async function POST(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const mgr = canValidate(authed.profile.role_key, authed.profile.is_admin);
    const me = await myEmployee(authed.profile.email);
    const b = await request.json().catch(() => ({}));

    // staffing intelligence (advisory): rank employees by matching VALIDATED skills minus workload
    if (b.action === 'staffing') {
        if (!mgr) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const want: string[] = (Array.isArray(b.skills) ? b.skills : []).map((s: any) => String(s).trim().toLowerCase()).filter(Boolean);
        const minLevel = Number(b.min_level) || 1;
        if (!want.length) return NextResponse.json({ error: 'no_skills', message: 'أدخل مهارة واحدة على الأقل.' }, { status: 400 });
        const { data: skills } = await supabaseAdmin.from('employee_skills').select('employee_id, skill, level, validated').eq('validated', true).gte('level', minLevel);
        const { data: emps } = await supabaseAdmin.from('employees').select('EmployeeID, Name, Department, Position, CurrentProjects').is('deleted_at', null);
        const empMap: Record<string, any> = {}; for (const e of emps || []) empMap[e.EmployeeID] = e;
        const matchByEmp: Record<string, any[]> = {};
        for (const s of skills || []) { if (want.some(w => String(s.skill).toLowerCase().includes(w))) (matchByEmp[s.employee_id] ||= []).push(s); }
        const results = [];
        for (const [eid, matched] of Object.entries(matchByEmp)) {
            const e = empMap[eid]; if (!e) continue;
            const load = await openTaskCount(eid);
            // score: matched skills + average level bonus − workload penalty (advisory heuristic)
            const avgLevel = matched.reduce((a, s: any) => a + s.level, 0) / matched.length;
            const score = matched.length * 10 + avgLevel * 2 - load * 1.5;
            results.push({ employee: e, matched, open_tasks: load, projects: e.CurrentProjects || [], score: Math.round(score * 10) / 10 });
        }
        results.sort((a, b) => b.score - a.score);
        return NextResponse.json({ candidates: results, note: 'ترشيح استشاري فقط — الإسناد يتطلب موافقة بشرية.' });
    }

    if (!me) return NextResponse.json({ error: 'no_employee', message: 'لا يوجد ملف موظف مرتبط بحسابك.' }, { status: 404 });
    // a manager may act on another employee; otherwise self
    const targetId = (mgr && b.employee_id) ? String(b.employee_id) : me.EmployeeID;

    if (b.action === 'add_skill') {
        const skill = String(b.skill || '').trim(); if (!skill) return NextResponse.json({ error: 'skill required' }, { status: 400 });
        const selfClaim = targetId === me.EmployeeID && !mgr;
        const row = {
            employee_id: targetId, skill, level: Math.min(5, Math.max(1, Number(b.level) || 1)),
            source: mgr && b.employee_id ? 'manager' : 'self', notes: b.notes || null,
            validated: mgr ? true : false, validated_by: mgr ? (me.Name || authed.profile.email) : null, validated_at: mgr ? new Date().toISOString() : null,
        };
        const { error } = await supabaseAdmin.from('employee_skills').upsert(row, { onConflict: 'employee_id,skill', ignoreDuplicates: true });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, selfClaim });
    }
    if (b.action === 'add_cert') {
        const name = String(b.name || '').trim(); if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
        const { error } = await supabaseAdmin.from('employee_certifications').insert({
            employee_id: targetId, name, issuer: b.issuer || null, issued_on: b.issued_on || null, expires_on: b.expires_on || null,
            credential_url: b.credential_url || null, verified: mgr ? !!b.verified : false, verified_by: mgr && b.verified ? (me.Name || authed.profile.email) : null,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    }
    // link completed+passed courses into PENDING skills (manager still validates the level)
    if (b.action === 'from_courses') {
        const { data: enr } = await supabaseAdmin.from('course_enrollments').select('course_id').eq('employee_id', targetId).eq('status', 'completed').eq('assessment_passed', true);
        const ids = (enr || []).map((e: any) => e.course_id);
        if (!ids.length) return NextResponse.json({ ok: true, added: 0, message: 'لا كورسات مكتملة مع اجتياز التقييم بعد.' });
        const { data: cs } = await supabaseAdmin.from('courses').select('id, skill').in('id', ids);
        let added = 0;
        for (const c of cs || []) {
            if (!c.skill) continue;
            const { data: existing } = await supabaseAdmin.from('employee_skills').select('id').eq('employee_id', targetId).eq('skill', c.skill).maybeSingle();
            if (existing) continue;
            await supabaseAdmin.from('employee_skills').insert({ employee_id: targetId, skill: c.skill, level: 2, source: 'course', course_id: c.id, validated: false, evidence: 'إكمال كورس مع اجتياز التقييم — بانتظار اعتماد المدير' });
            added++;
        }
        return NextResponse.json({ ok: true, added });
    }
    return NextResponse.json({ error: 'bad_action' }, { status: 400 });
}

export async function PATCH(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canValidate(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden', message: 'الاعتماد للمدير فقط.' }, { status: 403 });
    const me = await myEmployee(authed.profile.email);
    const b = await request.json().catch(() => ({}));
    const by = me?.Name || authed.profile.email;

    if (b.action === 'validate_skill') {
        const level = Math.min(5, Math.max(1, Number(b.level) || 1));
        await supabaseAdmin.from('employee_skills').update({ validated: true, level, validated_by: by, validated_at: new Date().toISOString(), source: 'manager', updated_at: new Date().toISOString() }).eq('id', String(b.id || ''));
        return NextResponse.json({ ok: true });
    }
    if (b.action === 'set_level') {
        await supabaseAdmin.from('employee_skills').update({ level: Math.min(5, Math.max(1, Number(b.level) || 1)), updated_at: new Date().toISOString() }).eq('id', String(b.id || ''));
        return NextResponse.json({ ok: true });
    }
    if (b.action === 'verify_cert') {
        await supabaseAdmin.from('employee_certifications').update({ verified: true, verified_by: by }).eq('id', String(b.id || ''));
        return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'bad_action' }, { status: 400 });
}

export async function DELETE(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const mgr = canValidate(authed.profile.role_key, authed.profile.is_admin);
    const me = await myEmployee(authed.profile.email);
    const u = new URL(request.url);
    const kind = u.searchParams.get('kind'); const id = u.searchParams.get('id');
    if (!id || !kind) return NextResponse.json({ error: 'id and kind required' }, { status: 400 });
    const table = kind === 'cert' ? 'employee_certifications' : 'employee_skills';
    // self may delete only their own, unvalidated entries; managers may delete any
    let qy = supabaseAdmin.from(table).delete().eq('id', id);
    if (!mgr) { if (!me) return NextResponse.json({ error: 'no_employee' }, { status: 404 }); qy = qy.eq('employee_id', me.EmployeeID); if (table === 'employee_skills') qy = qy.eq('validated', false); }
    await qy;
    return NextResponse.json({ ok: true });
}
