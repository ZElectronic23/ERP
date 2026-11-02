// app/api/dashboard/analytics/route.ts — real aggregated figures for the dashboard charts.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { buildAccess } from '@/lib/auth/access';

const monthKey = (d: string | null) => (d ? String(d).slice(0, 7) : '');

export async function GET() {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Company-wide financials/clients/projects — owner/finance/manager only. Never clients/technicians.
    const { data: permRows } = await supabaseAdmin.from('user_permissions').select('module, can_view').eq('user_id', authed.profile.entity_id);
    if (!buildAccess(authed.profile, permRows).canFinancials) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const [emp, inv, exp, prj, cl] = await Promise.all([
            supabaseAdmin.from('employees').select('Department').is('deleted_at', null).eq('IsActive', true),
            supabaseAdmin.from('documents').select('total, payment_status, doc_date, client_id').eq('doc_type', 'IN').is('deleted_at', null),
            supabaseAdmin.from('expenses').select('Amount, Date').eq('Status', 'paid').is('deleted_at', null),
            supabaseAdmin.from('projects').select('Status').is('deleted_at', null),
            supabaseAdmin.from('clients').select('ClientId, ClientName').is('deleted_at', null),
        ]);

        // employees by department
        const deptMap: Record<string, number> = {};
        (emp.data || []).forEach((e: any) => { const k = e.Department || 'غير محدد'; deptMap[k] = (deptMap[k] || 0) + 1; });
        const employeesByDept = Object.entries(deptMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

        // financial totals (paid = invoice total when payment_status === 'paid')
        const paidOf = (d: any) => (d.payment_status === 'paid' ? (Number(d.total) || 0) : 0);
        const revenue = (inv.data || []).reduce((s: number, d: any) => s + paidOf(d), 0);
        const invoicedTotal = (inv.data || []).reduce((s: number, d: any) => s + (Number(d.total) || 0), 0);
        const expenses = (exp.data || []).reduce((s: number, d: any) => s + (Number(d.Amount) || 0), 0);
        const financial = [
            { name: 'الإيرادات المحصّلة', value: Math.round(revenue) },
            { name: 'المصروفات', value: Math.round(expenses) },
            { name: 'صافي الربح', value: Math.round(revenue - expenses) },
        ];

        // monthly revenue vs expenses (last 6 months present in data)
        const mRev: Record<string, number> = {}, mExp: Record<string, number> = {};
        (inv.data || []).forEach((d: any) => { const k = monthKey(d.doc_date); if (k) mRev[k] = (mRev[k] || 0) + paidOf(d); });
        (exp.data || []).forEach((d: any) => { const k = monthKey(d.Date); if (k) mExp[k] = (mExp[k] || 0) + (Number(d.Amount) || 0); });
        const months = Array.from(new Set([...Object.keys(mRev), ...Object.keys(mExp)])).sort().slice(-6);
        const monthly = months.map(m => ({ name: m, revenue: Math.round(mRev[m] || 0), expenses: Math.round(mExp[m] || 0) }));

        // receivables (outstanding) by client — top 6
        const nameMap: Record<string, string> = {};
        (cl.data || []).forEach((c: any) => { nameMap[c.ClientId] = c.ClientName; });
        const outMap: Record<string, number> = {};
        (inv.data || []).forEach((d: any) => {
            const out = (Number(d.total) || 0) - paidOf(d);
            if (out > 0 && d.client_id) outMap[d.client_id] = (outMap[d.client_id] || 0) + out;
        });
        const receivables = Object.entries(outMap).map(([id, value]) => ({ name: nameMap[id] || id, value: Math.round(value) }))
            .sort((a, b) => b.value - a.value).slice(0, 6);
        const totalOutstanding = Math.round(invoicedTotal - revenue);

        // projects by status
        const stMap: Record<string, number> = {};
        (prj.data || []).forEach((p: any) => { const k = p.Status || 'غير محدد'; stMap[k] = (stMap[k] || 0) + 1; });
        const projectsByStatus = Object.entries(stMap).map(([name, value]) => ({ name, value }));

        return NextResponse.json({
            employeesByDept, financial, monthly, receivables, projectsByStatus,
            kpis: { revenue: Math.round(revenue), expenses: Math.round(expenses), net: Math.round(revenue - expenses), outstanding: totalOutstanding },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
