// Meetings — permissioned list + create. Each employee sees meetings they organize or are
// invited to, plus org-wide / their-department meetings per visibility. Owner/HR see all.
// Virtual rooms default to Jitsi Meet (free/open-source, no credentials) with an optional
// custom link (Google Meet / Zoom / Teams) when the organizer supplies one.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';

const FULL = ['ceo', 'admin', 'general_manager'];
const HR = ['hrd', 'hr'];

async function myEmployee(email: string | null) {
    if (!email) return null;
    const { data } = await supabaseAdmin.from('employees').select('EmployeeID, Name, Department').eq('WorkEmail', email).maybeSingle();
    return data;
}

// The canonical Jitsi room for a meeting (stable, unguessable enough for an internal tool).
export function jitsiRoom(id: string) { return `ZElectronic-${id.replace(/-/g, '').slice(0, 20)}`; }

export async function GET() {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const emp = await myEmployee(authed.profile.email);
    if (!emp) return NextResponse.json({ error: 'no_employee', message: 'لا يوجد ملف موظف مرتبط بحسابك.' }, { status: 404 });

    const rk = (authed.profile.role_key || '').toLowerCase();
    const canSeeAll = FULL.includes(rk) || HR.includes(rk) || !!authed.profile.is_admin;

    const [{ data: allMeetings }, { data: myParts }] = await Promise.all([
        supabaseAdmin.from('meetings').select('*').is('deleted_at', null).order('start_at', { ascending: false }),
        supabaseAdmin.from('meeting_participants').select('meeting_id, response').eq('employee_id', emp.EmployeeID),
    ]);
    const myMeetingIds = new Set((myParts || []).map((p: any) => p.meeting_id));
    const myResponse: Record<string, string> = {};
    for (const p of myParts || []) myResponse[p.meeting_id] = p.response;

    const visible = (allMeetings || []).filter((m: any) =>
        canSeeAll || m.organizer_employee_id === emp.EmployeeID || myMeetingIds.has(m.id) ||
        m.visibility === 'all' || (m.visibility === 'department' && m.department && m.department === emp.Department));

    // participants for the visible meetings, grouped, with names
    const ids = visible.map((m: any) => m.id);
    const partsByMeeting: Record<string, any[]> = {};
    if (ids.length) {
        const { data: parts } = await supabaseAdmin.from('meeting_participants').select('*').in('meeting_id', ids);
        const empIds = Array.from(new Set((parts || []).map((p: any) => p.employee_id)));
        const { data: emps } = await supabaseAdmin.from('employees').select('EmployeeID, Name').in('EmployeeID', empIds.length ? empIds : ['__none__']);
        const nameOf: Record<string, string> = {};
        for (const e of emps || []) nameOf[e.EmployeeID] = e.Name;
        for (const p of parts || []) {
            (partsByMeeting[p.meeting_id] ||= []).push({ ...p, name: nameOf[p.employee_id] || p.employee_id });
        }
    }

    const meetings = visible.map((m: any) => ({
        ...m,
        participants: partsByMeeting[m.id] || [],
        my_response: myResponse[m.id] || (m.organizer_employee_id === emp.EmployeeID ? 'organizer' : null),
        is_organizer: m.organizer_employee_id === emp.EmployeeID,
    }));

    return NextResponse.json({ employee: { id: emp.EmployeeID, name: emp.Name, department: emp.Department }, canSeeAll, meetings });
}

export async function POST(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const emp = await myEmployee(authed.profile.email);
    if (!emp) return NextResponse.json({ error: 'no_employee', message: 'لا يوجد ملف موظف مرتبط بحسابك.' }, { status: 404 });

    const b = await request.json().catch(() => ({}));
    const title = (b.title || '').toString().trim();
    const start_at = (b.start_at || '').toString();
    if (!title || !start_at) return NextResponse.json({ error: 'title and start_at required', message: 'العنوان ووقت البدء مطلوبان.' }, { status: 400 });

    const mode = ['in_person', 'virtual', 'hybrid'].includes(b.mode) ? b.mode : 'virtual';
    const provider = ['jitsi', 'google_meet', 'zoom', 'teams', 'other'].includes(b.provider) ? b.provider : 'jitsi';
    const visibility = ['invitees', 'department', 'all'].includes(b.visibility) ? b.visibility : 'invitees';
    const agenda = Array.isArray(b.agenda) ? b.agenda.filter((a: any) => a && a.text).map((a: any) => ({ text: String(a.text).slice(0, 300), minutes: Number(a.minutes) || null })) : [];

    const { data: meeting, error } = await supabaseAdmin.from('meetings').insert({
        title, description: b.description || null, organizer_employee_id: emp.EmployeeID,
        start_at, end_at: b.end_at || null, mode, location: b.location || null,
        provider, meet_url: b.meet_url || null, agenda, visibility,
        department: visibility === 'department' ? (b.department || emp.Department || null) : null,
        project_code: b.project_code || null, created_by: authed.profile.email || null,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // the room name is derived from the id (needs the row to exist first)
    await supabaseAdmin.from('meetings').update({ room_name: jitsiRoom(meeting.id) }).eq('id', meeting.id);

    // participants: organizer + invited employees (dedup, never the organizer twice)
    const inviteeIds: string[] = Array.from(new Set((Array.isArray(b.invitee_ids) ? b.invitee_ids : []).map((x: any) => String(x)).filter((x: string) => x && x !== emp.EmployeeID)));
    const optionalIds = new Set((Array.isArray(b.optional_ids) ? b.optional_ids : []).map((x: any) => String(x)));
    const rows = [
        { meeting_id: meeting.id, employee_id: emp.EmployeeID, role: 'organizer', response: 'accepted' },
        ...inviteeIds.map(id => ({ meeting_id: meeting.id, employee_id: id, role: optionalIds.has(id) ? 'optional' : 'required', response: 'pending' })),
    ];
    if (rows.length) await supabaseAdmin.from('meeting_participants').insert(rows);

    return NextResponse.json({ ok: true, id: meeting.id, room_name: jitsiRoom(meeting.id) });
}
