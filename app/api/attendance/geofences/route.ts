// HR management of attendance geofences + employee assignments. Gated to HR / admin / CEO.
// GET: geofences + assignments + employee list (for the HR map editor).
// POST: create a geofence. PATCH: assign/unassign an employee. DELETE: remove a geofence.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { buildAccess } from '@/lib/auth/access';

async function gate() {
    const authed = await requireUser();
    if (!authed) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    const { data: perms } = await supabaseAdmin.from('user_permissions').select('module, can_view').eq('user_id', authed.profile.entity_id);
    const access = buildAccess(authed.profile, perms);
    if (!access.isFull && !access.has('hr')) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    return { authed };
}

export async function GET() {
    const g = await gate();
    if (g.error) return g.error;
    const [{ data: geofences }, { data: assignments }, { data: employees }] = await Promise.all([
        supabaseAdmin.from('geofences').select('*').order('created_at', { ascending: false }),
        supabaseAdmin.from('geofence_assignments').select('*').eq('active', true),
        supabaseAdmin.from('employees').select('EmployeeID, Name, Department').is('deleted_at', null).order('Name'),
    ]);
    return NextResponse.json({ geofences: geofences || [], assignments: assignments || [], employees: employees || [] });
}

export async function POST(request: Request) {
    const g = await gate();
    if (g.error) return g.error;
    const b = await request.json().catch(() => ({}));
    const name = (b.name || '').toString().trim();
    const lat = Number(b.center_lat), lng = Number(b.center_lng), radius = Number(b.radius_m);
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: 'center_lat/center_lng required' }, { status: 400 });
    const radius_m = Number.isFinite(radius) ? Math.max(20, Math.min(5000, Math.round(radius))) : 150;
    const polygon = Array.isArray(b.polygon) && b.polygon.length >= 3 ? b.polygon : null;
    const { data, error } = await supabaseAdmin.from('geofences').insert({
        name, project_code: b.project_code || null, center_lat: lat, center_lng: lng, radius_m, polygon,
        created_by: g.authed!.profile.email || null,
    }).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id });
}

export async function PATCH(request: Request) {
    const g = await gate();
    if (g.error) return g.error;
    const b = await request.json().catch(() => ({}));
    const employee_id = (b.employee_id || '').toString();
    const geofence_id = (b.geofence_id || '').toString();
    if (!employee_id || !geofence_id) return NextResponse.json({ error: 'employee_id and geofence_id required' }, { status: 400 });

    if (b.action === 'unassign') {
        await supabaseAdmin.from('geofence_assignments').delete().eq('employee_id', employee_id).eq('geofence_id', geofence_id);
        return NextResponse.json({ ok: true });
    }
    // assign (idempotent)
    const { error } = await supabaseAdmin.from('geofence_assignments')
        .upsert({ employee_id, geofence_id, active: true }, { onConflict: 'employee_id,geofence_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
    const g = await gate();
    if (g.error) return g.error;
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await supabaseAdmin.from('geofences').delete().eq('id', id);
    return NextResponse.json({ ok: true });
}
