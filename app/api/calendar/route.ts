// Personal calendar — every employee sees ONLY their own events: their meetings/work entries
// (calendar_events) merged with their dated tasks. Mapped to the employee by WorkEmail.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';

async function myEmployee(email: string | null) {
    if (!email) return null;
    const { data } = await supabaseAdmin.from('employees').select('EmployeeID, Name').eq('WorkEmail', email).maybeSingle();
    return data;
}

// Minimal iCal (.ics) parser → events {title,start,end}. Handles DATE and DATE-TIME DTSTART/DTEND.
function parseICS(text: string): { title: string; start: string; end: string | null }[] {
    const out: { title: string; start: string; end: string | null }[] = [];
    const toISO = (v: string) => {
        const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
        if (!m) return null;
        const [, y, mo, d, hh = '00', mm = '00', ss = '00', z] = m;
        return z ? `${y}-${mo}-${d}T${hh}:${mm}:${ss}Z` : `${y}-${mo}-${d}T${hh}:${mm}:${ss}`;
    };
    for (const block of text.split('BEGIN:VEVENT').slice(1)) {
        const body = block.split('END:VEVENT')[0];
        const sum = body.match(/\nSUMMARY[^:]*:(.+)/)?.[1]?.trim();
        const ds = body.match(/\nDTSTART[^:]*:([0-9TZ]+)/)?.[1];
        const de = body.match(/\nDTEND[^:]*:([0-9TZ]+)/)?.[1];
        const start = ds ? toISO(ds) : null;
        if (!start) continue;
        out.push({ title: (sum || 'حدث').replace(/\\,/g, ',').slice(0, 120), start, end: de ? toISO(de) : null });
    }
    return out;
}

async function externalEvents(employeeId: string) {
    const { data: subs } = await supabaseAdmin.from('calendar_subscriptions').select('ics_url, provider').eq('owner_employee_id', employeeId).eq('active', true);
    const events: any[] = [];
    for (const s of subs || []) {
        try {
            const res = await fetch(s.ics_url, { signal: AbortSignal.timeout(6000) });
            if (!res.ok) continue;
            const text = await res.text();
            for (const e of parseICS(text)) events.push({ id: `ext-${events.length}`, title: e.title, type: 'meeting', start: e.start, end: e.end, source: `external:${s.provider}` });
        } catch { /* skip a failing feed */ }
    }
    return events;
}

export async function GET() {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const emp = await myEmployee(authed.profile.email);
    if (!emp) return NextResponse.json({ error: 'no_employee', message: 'لا يوجد ملف موظف مرتبط بحسابك.' }, { status: 404 });

    const [{ data: events }, { data: tasks }, external, { data: subs }, { data: myParts }] = await Promise.all([
        supabaseAdmin.from('calendar_events').select('*').eq('owner_employee_id', emp.EmployeeID).order('start_at'),
        supabaseAdmin.from('tasks').select('TaskID, TaskName, StartDate, EndDate, ProjectID, Status').eq('EmployeeID', emp.EmployeeID).is('deleted_at', null),
        externalEvents(emp.EmployeeID),
        supabaseAdmin.from('calendar_subscriptions').select('id, provider, ics_url').eq('owner_employee_id', emp.EmployeeID).eq('active', true),
        supabaseAdmin.from('meeting_participants').select('meeting_id').eq('employee_id', emp.EmployeeID),
    ]);

    // meetings the employee organizes or is invited to (own calendar only — privacy preserved)
    const meetingIds = Array.from(new Set((myParts || []).map((p: any) => p.meeting_id)));
    let meetings: any[] = [];
    if (meetingIds.length) {
        const { data } = await supabaseAdmin.from('meetings').select('id, title, start_at, end_at, location, project_code, status').in('id', meetingIds).is('deleted_at', null).neq('status', 'cancelled');
        meetings = data || [];
    }

    const merged = [
        ...(events || []).map((e: any) => ({ id: e.id, title: e.title, type: e.type, start: e.start_at, end: e.end_at, location: e.location, project: e.project_code, source: 'event' })),
        ...(tasks || []).filter((t: any) => t.StartDate || t.EndDate).map((t: any) => ({ id: t.TaskID, title: t.TaskName, type: 'task', start: t.StartDate, end: t.EndDate, project: t.ProjectID, status: t.Status, source: 'task' })),
        ...meetings.map((m: any) => ({ id: m.id, title: m.title, type: 'meeting', start: m.start_at, end: m.end_at, location: m.location, project: m.project_code, status: m.status, source: 'meeting' })),
        ...external,
    ];
    return NextResponse.json({ employee: { id: emp.EmployeeID, name: emp.Name }, events: merged, subscriptions: subs || [] });
}

export async function POST(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const emp = await myEmployee(authed.profile.email);
    if (!emp) return NextResponse.json({ error: 'no_employee', message: 'لا يوجد ملف موظف مرتبط بحسابك.' }, { status: 404 });

    const b = await request.json().catch(() => ({}));

    // Link an external calendar by its iCal (.ics) feed URL.
    if (b.action === 'subscribe') {
        const ics_url = (b.ics_url || '').toString().trim();
        const provider = ['google', 'microsoft', 'apple', 'other'].includes(b.provider) ? b.provider : 'other';
        if (!/^https?:\/\//i.test(ics_url)) return NextResponse.json({ error: 'bad_url', message: 'أدخل رابط iCal صحيح (يبدأ بـ http).' }, { status: 400 });
        const { error } = await supabaseAdmin.from('calendar_subscriptions').insert({ owner_employee_id: emp.EmployeeID, provider, ics_url });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, message: 'تم ربط التقويم — ستظهر أحداثه تلقائياً.' });
    }
    if (b.action === 'unsubscribe') {
        await supabaseAdmin.from('calendar_subscriptions').delete().eq('id', (b.id || '').toString()).eq('owner_employee_id', emp.EmployeeID);
        return NextResponse.json({ ok: true });
    }

    const title = (b.title || '').toString().trim();
    const start_at = (b.start_at || '').toString();
    if (!title || !start_at) return NextResponse.json({ error: 'title and start_at required' }, { status: 400 });
    const type = ['meeting', 'task', 'work', 'project', 'other'].includes(b.type) ? b.type : 'meeting';
    const { error } = await supabaseAdmin.from('calendar_events').insert({
        owner_employee_id: emp.EmployeeID, title, type, start_at, end_at: b.end_at || null,
        location: b.location || null, notes: b.notes || null, project_code: b.project_code || null,
        created_by: authed.profile.email || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const emp = await myEmployee(authed.profile.email);
    if (!emp) return NextResponse.json({ error: 'no_employee' }, { status: 404 });
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    // only own events
    await supabaseAdmin.from('calendar_events').delete().eq('id', id).eq('owner_employee_id', emp.EmployeeID);
    return NextResponse.json({ ok: true });
}
