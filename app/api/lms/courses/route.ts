// LMS — course catalog. Any signed-in employee browses published courses relevant to them
// (their department / all-staff), with free-first ordering. HR / managers / owners see all and
// may create. No fabricated provider completions: external courses link out to the provider.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';

const FULL = ['ceo', 'admin', 'general_manager'];
const HR = ['hrd', 'hr', 'manager', 'pm', 'project_manager'];
export function canManageLms(role?: string | null, isAdmin?: boolean | null) {
    const rk = (role || '').toLowerCase();
    return !!isAdmin || FULL.includes(rk) || HR.includes(rk);
}

async function myEmployee(email: string | null) {
    if (!email) return null;
    const { data } = await supabaseAdmin.from('employees').select('EmployeeID, Name, Department').eq('WorkEmail', email).maybeSingle();
    return data;
}

export async function GET(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const emp = await myEmployee(authed.profile.email);
    const canManage = canManageLms(authed.profile.role_key, authed.profile.is_admin);

    const u = new URL(request.url);
    const q = (u.searchParams.get('q') || '').trim();
    const skill = u.searchParams.get('skill');
    const difficulty = u.searchParams.get('difficulty');
    const provider = u.searchParams.get('provider');
    const pricing = u.searchParams.get('pricing');
    const dept = u.searchParams.get('department');
    const mineOnly = u.searchParams.get('mine') === '1';

    let query = supabaseAdmin.from('courses').select('*').is('deleted_at', null);
    // non-managers only see published courses
    if (!canManage) query = query.eq('status', 'published');
    if (skill) query = query.or(`skill.ilike.%${skill}%,skill_tags.cs.{${skill}}`);
    if (difficulty) query = query.eq('difficulty', difficulty);
    if (provider) query = query.eq('provider', provider);
    if (pricing) query = query.eq('pricing', pricing);
    if (q) query = query.or(`title_ar.ilike.%${q}%,title_en.ilike.%${q}%,description.ilike.%${q}%,skill.ilike.%${q}%,provider.ilike.%${q}%`);
    const { data: courses, error } = await query.order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // my enrollments
    const enrollMap: Record<string, any> = {};
    if (emp) {
        const { data: enr } = await supabaseAdmin.from('course_enrollments').select('*').eq('employee_id', emp.EmployeeID);
        for (const e of enr || []) enrollMap[e.course_id] = e;
    }

    // relevance filter for ordinary employees: their department or all-staff (null department)
    const myDept = emp?.Department || null;
    let list = (courses || []).map((c: any) => ({ ...c, enrollment: enrollMap[c.id] || null }));
    if (dept) list = list.filter((c: any) => (c.department || '') === dept);
    if (mineOnly) list = list.filter((c: any) => c.enrollment);

    // free-first, then newest
    const rank: Record<string, number> = { free: 0, freemium: 1, paid: 2 };
    list.sort((a: any, b: any) => (rank[a.pricing] ?? 3) - (rank[b.pricing] ?? 3));

    return NextResponse.json({
        canManage, employee: emp ? { id: emp.EmployeeID, name: emp.Name, department: myDept } : null,
        courses: list,
    });
}

export async function POST(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageLms(authed.profile.role_key, authed.profile.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const b = await request.json().catch(() => ({}));
    if (!b?.title_ar) return NextResponse.json({ error: 'title_ar required', message: 'العنوان مطلوب.' }, { status: 400 });
    const arr = (v: any) => Array.isArray(v) ? v.filter(Boolean).map((x: any) => String(x)) : [];
    const oneOf = (v: any, opts: string[]) => opts.includes(v) ? v : null;

    const row = {
        title_ar: b.title_ar, title_en: b.title_en || null, provider: b.provider || 'internal', description: b.description || null,
        department: b.department || null, positions: arr(b.positions), skill: b.skill || null, skill_tags: arr(b.skill_tags),
        difficulty: oneOf(b.difficulty, ['beginner', 'intermediate', 'advanced', 'expert']), languages: arr(b.languages),
        has_subtitles: !!b.has_subtitles, duration_minutes: b.duration_minutes ? Number(b.duration_minutes) : null,
        prerequisites: b.prerequisites || null, instructor: b.instructor || null, objectives: b.objectives || null,
        outcomes: b.outcomes || null, assessment: b.assessment || null, certificate: !!b.certificate,
        pricing: oneOf(b.pricing, ['free', 'freemium', 'paid']), external_url: b.external_url || null, cover_emoji: b.cover_emoji || '📘',
        status: oneOf(b.status, ['draft', 'published', 'archived']) || 'draft', created_by: authed.profile.email || null,
    };
    const { data, error } = await supabaseAdmin.from('courses').insert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ course: data });
}
