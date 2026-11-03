// Meeting detail + actions: respond to an invite, organizer admit/remove, set status,
// save minutes/summary/transcript/decisions/action-items, edit, and convert an approved
// action item into an ERP task. Organizer-only actions are enforced server-side.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';

async function myEmployee(email: string | null) {
    if (!email) return null;
    const { data } = await supabaseAdmin.from('employees').select('EmployeeID, Name, Department').eq('WorkEmail', email).maybeSingle();
    return data;
}

// Same fallback identity as the list route: accounts without an employee row (owner/admin/…)
// still get a stable id so they can manage meetings they organize.
async function myIdentity(authed: { user: { id: string }; profile: { email: string } }) {
    const emp = await myEmployee(authed.profile.email);
    if (emp) return { id: emp.EmployeeID, name: emp.Name, department: emp.Department as string | null };
    const { data: u } = await supabaseAdmin.from('users').select('full_name, email').eq('entity_id', authed.user.id).maybeSingle();
    return { id: `user:${authed.user.id}`, name: u?.full_name || u?.email || authed.profile.email || 'مستخدم', department: null as string | null };
}

async function nextTaskId(): Promise<string> {
    const { data } = await supabaseAdmin.from('tasks').select('TaskID').ilike('TaskID', 'TSK-%').order('TaskID', { ascending: false }).limit(1);
    let n = 1; if (data && data.length) { const m = String(data[0].TaskID).match(/TSK-(\d+)/); if (m) n = parseInt(m[1]) + 1; }
    return `TSK-${n.toString().padStart(4, '0')}`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const me = await myIdentity(authed);

    const { data: meeting } = await supabaseAdmin.from('meetings').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { data: parts } = await supabaseAdmin.from('meeting_participants').select('*').eq('meeting_id', id);
    const empIds = Array.from(new Set((parts || []).map((p: any) => p.employee_id)));
    const { data: emps } = await supabaseAdmin.from('employees').select('EmployeeID, Name').in('EmployeeID', empIds.length ? empIds : ['__none__']);
    const nameOf: Record<string, string> = {}; for (const e of emps || []) nameOf[e.EmployeeID] = e.Name;
    const participants = (parts || []).map((p: any) => ({ ...p, name: nameOf[p.employee_id] || (p.employee_id === me.id ? me.name : p.employee_id) }));
    const is_organizer = meeting.organizer_employee_id === me.id;

    return NextResponse.json({ meeting, participants, is_organizer, me: me.id });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const me = await myIdentity(authed);

    const { data: meeting } = await supabaseAdmin.from('meetings').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const isOrganizer = meeting.organizer_employee_id === me.id;

    const b = await request.json().catch(() => ({}));
    const action = b.action || 'edit';
    const touch = { updated_at: new Date().toISOString() };

    // participant responds to their own invite
    if (action === 'respond') {
        const response = ['accepted', 'declined', 'tentative', 'pending'].includes(b.response) ? b.response : 'pending';
        const { error } = await supabaseAdmin.from('meeting_participants').update({ response }).eq('meeting_id', id).eq('employee_id', me.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    }

    // everything below is organizer-only
    if (!isOrganizer) return NextResponse.json({ error: 'Forbidden', message: 'منظّم الاجتماع فقط يمكنه هذا الإجراء.' }, { status: 403 });

    if (action === 'admit') {
        await supabaseAdmin.from('meeting_participants').update({ admitted: !!b.admitted }).eq('meeting_id', id).eq('employee_id', String(b.employee_id || ''));
        return NextResponse.json({ ok: true });
    }
    if (action === 'attended') {
        await supabaseAdmin.from('meeting_participants').update({ attended: !!b.attended }).eq('meeting_id', id).eq('employee_id', String(b.employee_id || ''));
        return NextResponse.json({ ok: true });
    }
    if (action === 'invite') {
        const ids: string[] = Array.from(new Set((Array.isArray(b.invitee_ids) ? b.invitee_ids : []).map((x: any) => String(x)).filter((x: string) => x && x !== me.id)));
        if (ids.length) {
            const rows = ids.map(eid => ({ meeting_id: id, employee_id: eid, role: 'required', response: 'pending' }));
            await supabaseAdmin.from('meeting_participants').upsert(rows, { onConflict: 'meeting_id,employee_id', ignoreDuplicates: true });
        }
        return NextResponse.json({ ok: true });
    }
    if (action === 'remove_participant') {
        await supabaseAdmin.from('meeting_participants').delete().eq('meeting_id', id).eq('employee_id', String(b.employee_id || '')).neq('role', 'organizer');
        return NextResponse.json({ ok: true });
    }
    if (action === 'status') {
        const status = ['scheduled', 'in_progress', 'completed', 'cancelled'].includes(b.status) ? b.status : meeting.status;
        await supabaseAdmin.from('meetings').update({ status, ...touch }).eq('id', id);
        return NextResponse.json({ ok: true });
    }
    // save minutes / summary / transcript (+consent) / decisions / action items
    if (action === 'notes') {
        const patch: Record<string, any> = { ...touch };
        for (const f of ['minutes', 'summary', 'transcript']) if (f in b) patch[f] = b[f] || null;
        if ('transcript_consent' in b) patch.transcript_consent = !!b.transcript_consent;
        if (Array.isArray(b.decisions)) patch.decisions = b.decisions.filter((d: any) => d && d.text).map((d: any) => ({ text: String(d.text).slice(0, 500) }));
        if (Array.isArray(b.action_items)) patch.action_items = b.action_items.filter((a: any) => a && a.text).map((a: any) => ({
            text: String(a.text).slice(0, 500), assignee_employee_id: a.assignee_employee_id || null,
            due: a.due || null, priority: ['low', 'medium', 'high'].includes(a.priority) ? a.priority : 'medium', task_id: a.task_id || null,
        }));
        await supabaseAdmin.from('meetings').update(patch).eq('id', id);
        return NextResponse.json({ ok: true });
    }
    // convert ONE approved action item (by index) into an ERP task (organizer approval = this click)
    if (action === 'action_to_task') {
        const items: any[] = Array.isArray(meeting.action_items) ? meeting.action_items : [];
        const idx = Number(b.index);
        const it = items[idx];
        if (!it || !it.text) return NextResponse.json({ error: 'bad_index' }, { status: 400 });
        if (it.task_id) return NextResponse.json({ ok: true, task_id: it.task_id, already: true });
        const TaskID = await nextTaskId();
        const { error } = await supabaseAdmin.from('tasks').insert([{
            TaskID, ProjectID: meeting.project_code || null, EmployeeID: it.assignee_employee_id || null,
            TaskName: it.text.slice(0, 200), Status: 'todo', TaskPriority: it.priority || 'medium', ApprovalStatus: 'pending',
            EndDate: it.due || null, AssignedBy: me.name || authed.profile.email || null,
            TaskNotes: `من اجتماع: ${meeting.title}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }]);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        items[idx] = { ...it, task_id: TaskID };
        await supabaseAdmin.from('meetings').update({ action_items: items, ...touch }).eq('id', id);
        return NextResponse.json({ ok: true, task_id: TaskID });
    }

    // default: edit core meeting fields
    const patch: Record<string, any> = { ...touch };
    for (const f of ['title', 'description', 'start_at', 'end_at', 'location', 'meet_url', 'project_code']) if (f in b) patch[f] = b[f] || null;
    if ('mode' in b && ['in_person', 'virtual', 'hybrid'].includes(b.mode)) patch.mode = b.mode;
    if ('provider' in b && ['jitsi', 'google_meet', 'zoom', 'teams', 'other'].includes(b.provider)) patch.provider = b.provider;
    if ('visibility' in b && ['invitees', 'department', 'all'].includes(b.visibility)) { patch.visibility = b.visibility; patch.department = b.visibility === 'department' ? (b.department || meeting.department) : null; }
    if (Array.isArray(b.agenda)) patch.agenda = b.agenda.filter((a: any) => a && a.text).map((a: any) => ({ text: String(a.text).slice(0, 300), minutes: Number(a.minutes) || null }));
    if (!patch.title && 'title' in b) return NextResponse.json({ error: 'title required' }, { status: 400 });
    await supabaseAdmin.from('meetings').update(patch).eq('id', id);
    return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const me = await myIdentity(authed);
    const { data: meeting } = await supabaseAdmin.from('meetings').select('organizer_employee_id').eq('id', id).maybeSingle();
    if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (meeting.organizer_employee_id !== me.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await supabaseAdmin.from('meetings').update({ deleted_at: new Date().toISOString(), status: 'cancelled' }).eq('id', id);
    return NextResponse.json({ ok: true });
}
