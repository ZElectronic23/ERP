// Geofenced biometric punch. POST records a punch ONLY when the GPS point falls inside one of
// the employee's assigned geofences (first punch of the day = check-in, any later = check-out).
// Outside the perimeter → 422 with a message, nothing recorded. GET returns today's status + history.
// The signed-in user is mapped to their employee record by WorkEmail (employees have no auth uid).
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { evaluatePoint, type Geofence } from '@/lib/attendance/geo';

async function myEmployee(email: string | null) {
    if (!email) return null;
    const { data } = await supabaseAdmin.from('employees').select('EmployeeID, Name, WorkEmail').eq('WorkEmail', email).maybeSingle();
    return data;
}

async function assignedFences(employeeId: string): Promise<Geofence[]> {
    const { data: asg } = await supabaseAdmin.from('geofence_assignments').select('geofence_id').eq('employee_id', employeeId).eq('active', true);
    const ids = (asg || []).map((a: any) => a.geofence_id);
    if (!ids.length) return [];
    const { data: fences } = await supabaseAdmin.from('geofences').select('*').in('id', ids).eq('active', true);
    return (fences || []) as Geofence[];
}

const dayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };

export async function GET() {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const emp = await myEmployee(authed.profile.email);
    if (!emp) return NextResponse.json({ error: 'no_employee', message: 'لا يوجد ملف موظف مرتبط بحسابك.' }, { status: 404 });

    const [{ data: today }, { data: recent }, fences] = await Promise.all([
        supabaseAdmin.from('attendance_punches').select('*').eq('employee_id', emp.EmployeeID).gte('ts', dayStart()).order('ts'),
        supabaseAdmin.from('attendance_punches').select('*').eq('employee_id', emp.EmployeeID).order('ts', { ascending: false }).limit(30),
        assignedFences(emp.EmployeeID),
    ]);
    const t = today || [];
    return NextResponse.json({
        employee: { id: emp.EmployeeID, name: emp.Name },
        hasGeofence: fences.length > 0,
        geofences: fences.map(f => ({ id: f.id, name: f.name, radius_m: f.radius_m })),
        checkIn: t.length ? t[0].ts : null,
        checkOut: t.length > 1 ? t[t.length - 1].ts : null,
        todayCount: t.length,
        recent: recent || [],
    });
}

export async function POST(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const emp = await myEmployee(authed.profile.email);
    if (!emp) return NextResponse.json({ error: 'no_employee', message: 'لا يوجد ملف موظف مرتبط بحسابك — راجع الموارد البشرية.' }, { status: 404 });

    const b = await request.json().catch(() => ({}));
    const lat = Number(b.lat), lng = Number(b.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return NextResponse.json({ error: 'no_location', message: 'تعذّر تحديد موقعك. فعّل خدمة الموقع (GPS) وحاول مجدداً.' }, { status: 400 });
    }

    const fences = await assignedFences(emp.EmployeeID);
    if (!fences.length) {
        return NextResponse.json({ error: 'no_geofence', message: 'لم يُحدَّد لك محيط عمل بعد — راجع الموارد البشرية.' }, { status: 409 });
    }

    const check = evaluatePoint(lat, lng, fences);
    if (!check.within) {
        // Outside the assigned perimeter → do NOT record; tell the user to try inside.
        return NextResponse.json({
            ok: false, within: false, distance_m: check.distance_m,
            message: `أنت خارج محيط العمل (تبعد ~${check.distance_m} متر). الرجاء المحاولة مرة أخرى داخل المحيط.`,
        }, { status: 422 });
    }

    // first punch today = check-in, otherwise check-out (the latest out is the effective checkout)
    const { count } = await supabaseAdmin.from('attendance_punches')
        .select('id', { count: 'exact', head: true }).eq('employee_id', emp.EmployeeID).gte('ts', dayStart());
    const kind = (count || 0) === 0 ? 'in' : 'out';

    const { error } = await supabaseAdmin.from('attendance_punches').insert({
        employee_id: emp.EmployeeID, lat, lng, within: true, distance_m: check.distance_m,
        geofence_id: check.geofence_id, kind, note: b.note || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
        ok: true, within: true, kind, distance_m: check.distance_m, geofence: check.geofence_name,
        message: kind === 'in' ? '✓ تم تسجيل الحضور بنجاح.' : '✓ تم تسجيل الانصراف بنجاح.',
    });
}
