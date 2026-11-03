// Development roadmaps — mandatory vs optional training per employee, workload-aware so no one
// is overloaded, linked to responsibilities and (optionally) to courses. Completion is pulled
// from the linked course enrollment, and a summary feeds back into the employee's development
// plan so evaluations can reference it. Managers assign; employees track and start.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';

const FULL = ['ceo', 'admin', 'general_manager'];
const MGR = ['hrd', 'hr', 'manager', 'pm', 'project_manager'];
const canAssign = (role?: string | null, isAdmin?: boolean | null) => {
    const rk = (role || '').toLowerCase(); return !!isAdmin || FULL.includes(rk) || MGR.includes(rk);
};
const OVERLOAD = 6; // open tasks + active mandatory items beyond which we warn

async function myEmployee(email: string | null) {
    if (!email) return null;
    const { data } = await supabaseAdmin.from('employees').select('EmployeeID, Name, Department, Position, DevelopmentPlan').eq('WorkEmail', email).maybeSingle();
    return data;
}
async function openTaskCount(empId: string) {
    const { count } = await supabaseAdmin.from('tasks').select('TaskID', { count: 'exact', head: true }).eq('EmployeeID', empId).is('deleted_at', null).neq('Status', 'done');
    return count || 0;
}

// effective status: a course-linked item follows its enrollment; otherwise its stored status
function effectiveStatus(item: any, enrollment: any): string {
    if (item.status === 'waived' || item.status === 'completed') return item.status;
    if (item.course_id && enrollment) {
        if (enrollment.status === 'completed') return 'completed';
        if (enrollment.status === 'in_progress' || (enrollment.progress_pct || 0) > 0) return 'in_progress';
    }
    return item.status;
}

export async function GET(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const mgr = canAssign(authed.profile.role_key, authed.profile.is_admin);
    const me = await myEmployee(authed.profile.email);
    const u = new URL(request.url);

    let target = me;
    const reqId = u.searchParams.get('employee_id');
    if (reqId && reqId !== me?.EmployeeID) {
        if (!mgr) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { data } = await supabaseAdmin.from('employees').select('EmployeeID, Name, Department, Position, DevelopmentPlan').eq('EmployeeID', reqId).maybeSingle();
        target = data;
    }
    if (!target) return NextResponse.json({ canAssign: mgr, employee: null, items: [], workload: { openTasks: 0, activeMandatory: 0, overloaded: false } });

    const { data: items } = await supabaseAdmin.from('roadmap_items').select('*').eq('employee_id', target.EmployeeID).is('deleted_at', null).order('requirement').order('target_date', { nullsFirst: false });
    const courseIds = (items || []).filter((i: any) => i.course_id).map((i: any) => i.course_id);
    const courseMap: Record<string, any> = {}, enrollMap: Record<string, any> = {};
    if (courseIds.length) {
        const [{ data: cs }, { data: enr }] = await Promise.all([
            supabaseAdmin.from('courses').select('id, title_ar, title_en, skill, duration_minutes').in('id', courseIds),
            supabaseAdmin.from('course_enrollments').select('course_id, status, progress_pct').eq('employee_id', target.EmployeeID).in('course_id', courseIds),
        ]);
        for (const c of cs || []) courseMap[c.id] = c;
        for (const e of enr || []) enrollMap[e.course_id] = e;
    }
    const enriched = (items || []).map((i: any) => ({
        ...i, course: i.course_id ? courseMap[i.course_id] || null : null,
        enrollment: i.course_id ? enrollMap[i.course_id] || null : null,
        effective_status: effectiveStatus(i, i.course_id ? enrollMap[i.course_id] : null),
    }));

    const openTasks = await openTaskCount(target.EmployeeID);
    const activeMandatory = enriched.filter((i: any) => i.requirement === 'mandatory' && i.effective_status !== 'completed' && i.effective_status !== 'waived').length;
    const mandatoryTotal = enriched.filter((i: any) => i.requirement === 'mandatory').length;
    const mandatoryDone = enriched.filter((i: any) => i.requirement === 'mandatory' && i.effective_status === 'completed').length;

    return NextResponse.json({
        canAssign: mgr, isSelf: target.EmployeeID === me?.EmployeeID, employee: target, items: enriched,
        workload: { openTasks, activeMandatory, overloaded: openTasks + activeMandatory >= OVERLOAD },
        metrics: { mandatoryTotal, mandatoryDone, completion: mandatoryTotal ? Math.round(mandatoryDone / mandatoryTotal * 100) : null },
    });
}

export async function POST(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canAssign(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden', message: 'إسناد التدريب للمدير فقط.' }, { status: 403 });
    const me = await myEmployee(authed.profile.email);
    const by = me?.Name || authed.profile.email;
    const b = await request.json().catch(() => ({}));
    const employee_id = String(b.employee_id || '');
    if (!employee_id) return NextResponse.json({ error: 'employee_id required' }, { status: 400 });

    if (b.action === 'add') {
        if (!b.course_id && !b.title) return NextResponse.json({ error: 'course_or_title', message: 'اختر كورساً أو اكتب عنوان التدريب.' }, { status: 400 });
        const { error } = await supabaseAdmin.from('roadmap_items').insert({
            employee_id, course_id: b.course_id || null, title: b.title || null,
            requirement: b.requirement === 'mandatory' ? 'mandatory' : 'optional',
            reason: b.reason || null, responsibility: b.responsibility || null, target_date: b.target_date || null,
            assigned_by: by, source: ['manual', 'evaluation', 'skill_gap'].includes(b.source) ? b.source : 'manual',
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    }
    // pull the latest evaluation's RecommendedTraining into an optional roadmap item
    if (b.action === 'from_evaluation') {
        const { data: ev } = await supabaseAdmin.from('evaluation').select('RecommendedTraining, Date').eq('EmployeeID', employee_id).is('deleted_at', null).not('RecommendedTraining', 'is', null).order('Date', { ascending: false }).limit(1).maybeSingle();
        if (!ev?.RecommendedTraining) return NextResponse.json({ ok: true, added: 0, message: 'لا يوجد تدريب موصى به في آخر تقييم.' });
        const { error } = await supabaseAdmin.from('roadmap_items').insert({
            employee_id, title: ev.RecommendedTraining, requirement: 'optional', reason: 'موصى به في التقييم', source: 'evaluation', assigned_by: by,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, added: 1 });
    }
    // write a concise roadmap summary into the employee's development plan (feeds evaluations)
    if (b.action === 'sync_development_plan') {
        const { data: items } = await supabaseAdmin.from('roadmap_items').select('title, course_id, requirement, status').eq('employee_id', employee_id).is('deleted_at', null);
        const man = (items || []).filter((i: any) => i.requirement === 'mandatory');
        const done = man.filter((i: any) => i.status === 'completed').length;
        const summary = `خطة التطوير (${new Date().toISOString().slice(0, 10)}): إلزامي ${done}/${man.length} مكتمل · إجمالي بنود ${items?.length || 0}.`;
        await supabaseAdmin.from('employees').update({ DevelopmentPlan: summary, updated_at: new Date().toISOString() }).eq('EmployeeID', employee_id);
        return NextResponse.json({ ok: true, summary });
    }
    return NextResponse.json({ error: 'bad_action' }, { status: 400 });
}

export async function PATCH(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const mgr = canAssign(authed.profile.role_key, authed.profile.is_admin);
    const me = await myEmployee(authed.profile.email);
    const b = await request.json().catch(() => ({}));
    const id = String(b.id || '');
    const { data: item } = await supabaseAdmin.from('roadmap_items').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const isOwner = me && item.employee_id === me.EmployeeID;

    if (b.action === 'status') {
        const status = ['planned', 'in_progress', 'completed', 'waived'].includes(b.status) ? b.status : item.status;
        // employees may move their own non-mandatory progress; 'waived' and mandatory-complete need a manager
        if (!mgr) {
            if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            if (status === 'waived') return NextResponse.json({ error: 'Forbidden', message: 'الإعفاء من صلاحية المدير.' }, { status: 403 });
        }
        await supabaseAdmin.from('roadmap_items').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
        return NextResponse.json({ ok: true });
    }
    // edits (requirement/target/reason) are manager-only
    if (!mgr) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const f of ['title', 'reason', 'responsibility', 'target_date']) if (f in b) patch[f] = b[f] || null;
    if ('requirement' in b && ['mandatory', 'optional'].includes(b.requirement)) patch.requirement = b.requirement;
    await supabaseAdmin.from('roadmap_items').update(patch).eq('id', id);
    return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canAssign(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await supabaseAdmin.from('roadmap_items').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ ok: true });
}
