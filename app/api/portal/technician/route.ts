// Technician / engineer self-service portal data — everything scoped to the SIGNED-IN employee
// only (mapped by WorkEmail). GET aggregates his projects, tasks, calendar, requests, custody,
// evaluation + recommended trainings, and attendance. PATCH updates the status of his OWN task.
// POST submits a new leave request for himself. Reduces HR load; never exposes others' data.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';

async function me() {
    const authed = await requireUser();
    if (!authed) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    const { data: emp } = await supabaseAdmin.from('employees')
        .select('EmployeeID, Name, Department, WorkEmail, LeaveBalance').eq('WorkEmail', authed.profile.email).maybeSingle();
    if (!emp) return { error: NextResponse.json({ error: 'no_employee', message: 'لا يوجد ملف موظف مرتبط بحسابك.' }, { status: 404 }) };
    return { authed, emp };
}

const dayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };

export async function GET() {
    const g = await me();
    if (g.error) return g.error;
    const emp = g.emp!;
    const id = emp.EmployeeID;

    const [tasksRes, managed, leaves, approvalsRes, procRes, evalLegacy, evalNew, punchToday, punchRecent] = await Promise.all([
        supabaseAdmin.from('tasks').select('*').eq('EmployeeID', id).is('deleted_at', null).order('created_at', { ascending: false }),
        supabaseAdmin.from('projects').select('ProjectCode, ProjectName, Status, journey_stage').eq('ManagerID', id).is('deleted_at', null),
        supabaseAdmin.from('leave_requests').select('*').eq('employee_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
        supabaseAdmin.from('approvals').select('entity_type, entity_id, status, title, cycle').eq('requested_by', g.authed!.profile.entity_id),
        supabaseAdmin.from('project_procurements').select('*').or(`requested_by.eq.${id},requested_by.eq.${emp.Name}`).is('deleted_at', null).order('created_at', { ascending: false }),
        supabaseAdmin.from('evaluation').select('*').eq('EmployeeID', id).is('deleted_at', null).order('Date', { ascending: false }),
        supabaseAdmin.from('evaluations').select('*').eq('target_type', 'employee').eq('target_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
        supabaseAdmin.from('attendance_punches').select('*').eq('employee_id', id).gte('ts', dayStart()).order('ts'),
        supabaseAdmin.from('attendance_punches').select('*').eq('employee_id', id).order('ts', { ascending: false }).limit(30),
    ]);

    const tasks = tasksRes.data || [];
    // Projects = projects he manages + projects his tasks belong to.
    const taskProjectCodes = Array.from(new Set(tasks.map((t: any) => t.ProjectID).filter(Boolean)));
    let taskProjects: any[] = [];
    if (taskProjectCodes.length) {
        const { data } = await supabaseAdmin.from('projects').select('ProjectCode, ProjectName, Status, journey_stage').in('ProjectCode', taskProjectCodes).is('deleted_at', null);
        taskProjects = data || [];
    }
    const projMap = new Map<string, any>();
    [...(managed.data || []), ...taskProjects].forEach(p => projMap.set(p.ProjectCode, p));

    // Calendar: tasks that have a start/end become dated events (visits / maintenance / assignments).
    const calendar = tasks.filter((t: any) => t.StartDate || t.EndDate).map((t: any) => ({
        id: t.TaskID, title: t.TaskName, start: t.StartDate, end: t.EndDate,
        status: t.Status, project: t.ProjectID,
    }));

    // Custody = procurement rows of kind 'custody' requested for / by him.
    const custody = (procRes.data || []).filter((p: any) => p.kind === 'custody');

    // Recommended trainings derived from his evaluations' RecommendedTraining (real data, no fabrication).
    const trainings = (evalLegacy.data || [])
        .map((e: any) => e.RecommendedTraining)
        .filter((x: any) => x && String(x).trim())
        .flatMap((x: string) => x.split(/[,،\n]/).map(s => s.trim()).filter(Boolean));

    const today = punchToday.data || [];

    return NextResponse.json({
        employee: { id, name: emp.Name, department: emp.Department, leaveBalance: emp.LeaveBalance },
        projects: Array.from(projMap.values()),
        tasks,
        calendar,
        requests: {
            approvals: approvalsRes.data || [],
            leaves: leaves.data || [],
            procurements: procRes.data || [],
        },
        custody,
        evaluations: { legacy: evalLegacy.data || [], scored: evalNew.data || [] },
        trainings: Array.from(new Set(trainings)),
        attendance: {
            checkIn: today.length ? today[0].ts : null,
            checkOut: today.length > 1 ? today[today.length - 1].ts : null,
            recent: punchRecent.data || [],
        },
    });
}

export async function PATCH(request: Request) {
    const g = await me();
    if (g.error) return g.error;
    const b = await request.json().catch(() => ({}));
    const taskId = (b.taskId || '').toString();
    const status = (b.status || '').toString();
    if (!taskId || !['todo', 'in_progress', 'review', 'done'].includes(status)) {
        return NextResponse.json({ error: 'taskId and a valid status are required' }, { status: 400 });
    }
    // Only his own task.
    const { data: task } = await supabaseAdmin.from('tasks').select('TaskID, EmployeeID').eq('TaskID', taskId).maybeSingle();
    if (!task || task.EmployeeID !== g.emp!.EmployeeID) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { error } = await supabaseAdmin.from('tasks').update({ Status: status, updated_at: new Date().toISOString() }).eq('TaskID', taskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
    const g = await me();
    if (g.error) return g.error;
    const b = await request.json().catch(() => ({}));
    if (b.action !== 'leave') return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    const leave_type = ['annual', 'sick', 'unpaid', 'emergency'].includes(b.leave_type) ? b.leave_type : 'annual';
    const start_date = (b.start_date || '').toString();
    const end_date = (b.end_date || '').toString();
    if (!start_date || !end_date) return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 });
    const days = Math.max(1, Math.floor((new Date(end_date).getTime() - new Date(start_date).getTime()) / 86400000) + 1);
    const { error } = await supabaseAdmin.from('leave_requests').insert({
        employee_id: g.emp!.EmployeeID, leave_type, start_date, end_date, days,
        reason: (b.reason || '').toString() || null, status: 'pending',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
