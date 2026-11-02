// Smart alerts for the signed-in user, graded by importance: overdue/today tasks, managed
// projects nearing their deadline while unfinished, and (for finance/HR) the month-end payroll
// closing reminder. All derived from REAL records; scoped to the user.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { buildAccess } from '@/lib/auth/access';

type Level = 'high' | 'medium' | 'low';
const dayStr = (d: Date) => d.toISOString().slice(0, 10);

export async function GET() {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: perms } = await supabaseAdmin.from('user_permissions').select('module, can_view').eq('user_id', authed.profile.entity_id);
    const access = buildAccess(authed.profile, perms);
    const { data: emp } = await supabaseAdmin.from('employees').select('EmployeeID').eq('WorkEmail', authed.profile.email).maybeSingle();

    const today = new Date(); const todayStr = dayStr(today);
    const alerts: { level: Level; icon: string; title: string }[] = [];

    if (emp) {
        // my tasks not done
        const { data: tasks } = await supabaseAdmin.from('tasks')
            .select('TaskName, EndDate, StartDate, Status').eq('EmployeeID', emp.EmployeeID).is('deleted_at', null);
        const open = (tasks || []).filter((t: any) => t.Status !== 'done');
        const overdue = open.filter((t: any) => t.EndDate && dayStr(new Date(t.EndDate)) < todayStr);
        const dueToday = open.filter((t: any) => (t.EndDate && dayStr(new Date(t.EndDate)) === todayStr) || (t.StartDate && dayStr(new Date(t.StartDate)) === todayStr));
        if (overdue.length) alerts.push({ level: 'high', icon: '⏰', title: `لديك ${overdue.length} مهمة متأخرة عن موعدها — راجعها فوراً.` });
        if (dueToday.length) {
            const endOfDay = today.getHours() >= 15;
            alerts.push({ level: endOfDay ? 'high' : 'medium', icon: '📌', title: endOfDay ? `اليوم قارب على الانتهاء ولديك ${dueToday.length} مهمة لم تكتمل بعد.` : `لديك ${dueToday.length} مهمة مستحقّة اليوم.` });
        }

        // projects I manage, near deadline, not completed
        const { data: myProjects } = await supabaseAdmin.from('projects')
            .select('ProjectCode, ProjectName, PlannedEnd, Status').eq('ManagerID', emp.EmployeeID).is('deleted_at', null);
        for (const p of myProjects || []) {
            const st = String(p.Status || '').toLowerCase();
            const done = /complet|closed|مكتمل|مغلق|منته/.test(st);
            if (done || !p.PlannedEnd) continue;
            const end = new Date(p.PlannedEnd); const diffDays = Math.ceil((end.getTime() - today.getTime()) / 86400000);
            if (diffDays < 0) alerts.push({ level: 'high', icon: '🏗️', title: `مشروع «${p.ProjectName || p.ProjectCode}» تجاوز موعد انتهائه ولم يُكمَل بعد.` });
            else if (diffDays <= 7) alerts.push({ level: 'medium', icon: '🏗️', title: `مشروع «${p.ProjectName || p.ProjectCode}» ينتهي خلال ${diffDays} يوم ولا تزال هناك خطوات غير مكتملة.` });
        }
    }

    // payroll closing reminder (finance / HR / admin) in the last 3 days of the month
    const isHrFinance = access.isFull || access.has('payroll') || access.canFinancials;
    if (isHrFinance) {
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        if (last - today.getDate() <= 3) {
            alerts.push({ level: 'high', icon: '💵', title: 'اقترب موعد تقفيل مرتبات الشهر الحالي — تأكّد من إغلاق المسيّر قبل نهاية الشهر.' });
        }
    }

    const order: Record<Level, number> = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => order[a.level] - order[b.level]);
    return NextResponse.json({ alerts });
}
