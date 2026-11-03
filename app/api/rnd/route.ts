// Research & Development board. An R&D item moves through stages (idea → research → prototype
// → testing → review → done/rejected) and LINKS to other departments: a project it feeds, a
// product it will become, the technical survey that sparked it and the employee who owns it.
// Internal staff see the board; managers/R&D roles create and move items.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';

const FULL = ['ceo', 'admin', 'general_manager'];
const MGR = ['hrd', 'hr', 'manager', 'pm', 'project_manager', 'rnd', 'researcher'];
const canManage = (role?: string | null, isAdmin?: boolean | null) => {
    const rk = (role || '').toLowerCase(); return !!isAdmin || FULL.includes(rk) || MGR.includes(rk);
};

const STAGES = ['idea', 'research', 'prototype', 'testing', 'review', 'done', 'rejected'];
const EDITABLE = ['title', 'description', 'category', 'stage', 'priority', 'status', 'owner_employee_id',
    'project_id', 'product_id', 'survey_id', 'expected_outcome', 'budget_estimate', 'progress_pct', 'tags', 'start_date', 'target_date'];

async function nextId(): Promise<string> {
    const { data } = await supabaseAdmin.from('rnd_items').select('id').order('id', { ascending: false }).limit(1);
    const last = data?.[0]?.id as string | undefined;
    const n = last && /RND-(\d+)/.test(last) ? parseInt(last.match(/RND-(\d+)/)![1], 10) + 1 : 1;
    return `RND-${String(n).padStart(4, '0')}`;
}

export async function GET(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const mgr = canManage(authed.profile.role_key, authed.profile.is_admin);
    const u = new URL(request.url);
    const stage = u.searchParams.get('stage');

    let q = supabaseAdmin.from('rnd_items').select('*').is('deleted_at', null);
    if (stage && STAGES.includes(stage)) q = q.eq('stage', stage);
    const { data: items, error } = await q.order('priority', { ascending: true }).order('updated_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // resolve linked names (owner / project / product) for display
    const list = items || [];
    const empIds = [...new Set(list.map(i => i.owner_employee_id).filter(Boolean))];
    const projIds = [...new Set(list.map(i => i.project_id).filter(Boolean))];
    const prodIds = [...new Set(list.map(i => i.product_id).filter(Boolean))];
    const [emps, projs, prods] = await Promise.all([
        empIds.length ? supabaseAdmin.from('employees').select('EmployeeID, Name').in('EmployeeID', empIds) : Promise.resolve({ data: [] as any[] }),
        projIds.length ? supabaseAdmin.from('projects').select('ProjectID, ProjectName').in('ProjectID', projIds) : Promise.resolve({ data: [] as any[] }),
        prodIds.length ? supabaseAdmin.from('products').select('product_id, name').in('product_id', prodIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const empMap = Object.fromEntries((emps.data || []).map((e: any) => [e.EmployeeID, e.Name]));
    const projMap = Object.fromEntries((projs.data || []).map((p: any) => [p.ProjectID, p.ProjectName]));
    const prodMap = Object.fromEntries((prods.data || []).map((p: any) => [p.product_id, p.name]));
    const enriched = list.map(i => ({
        ...i,
        owner_name: i.owner_employee_id ? empMap[i.owner_employee_id] || i.owner_employee_id : null,
        project_name: i.project_id ? projMap[i.project_id] || i.project_id : null,
        product_name: i.product_id ? prodMap[i.product_id] || i.product_id : null,
    }));

    // light option lists so the form can link to real projects/products/employees
    const [{ data: allProjects }, { data: allProducts }, { data: allEmployees }] = await Promise.all([
        supabaseAdmin.from('projects').select('ProjectID, ProjectName').is('deleted_at', null).order('ProjectName').limit(500),
        supabaseAdmin.from('products').select('product_id, name').order('name').limit(500),
        supabaseAdmin.from('employees').select('EmployeeID, Name, Department').order('Name').limit(500),
    ]);
    return NextResponse.json({
        canManage: mgr, items: enriched, stages: STAGES,
        links: { projects: allProjects || [], products: allProducts || [], employees: allEmployees || [] },
    });
}

export async function POST(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManage(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });

    const row: any = { id: await nextId(), created_by: authed.profile.email };
    for (const k of EDITABLE) if (body[k] !== undefined) row[k] = body[k];
    if (row.stage && !STAGES.includes(row.stage)) row.stage = 'idea';
    const { data, error } = await supabaseAdmin.from('rnd_items').insert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
}

export async function PATCH(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManage(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const patch: any = { updated_at: new Date().toISOString() };
    for (const k of EDITABLE) if (body[k] !== undefined) patch[k] = body[k];
    if (patch.stage && !STAGES.includes(patch.stage)) return NextResponse.json({ error: 'bad stage' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('rnd_items').update(patch).eq('id', body.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
}

export async function DELETE(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManage(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('rnd_items').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
