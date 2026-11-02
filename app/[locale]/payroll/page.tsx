'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';

// Monthly payroll: net salary per employee using insurance/tax rates from settings,
// with a one-click posting of the balanced payroll journal entry to accounting.
export default function PayrollPage() {
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [emps, setEmps] = useState<any[]>([]);
    const [settings, setSettings] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [msg, setMsg] = useState('');
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
    const [payVia, setPayVia] = useState('bank');

    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: em }, { data: st }] = await Promise.all([
            supabase.from('employees').select('EmployeeID, Name, Position, MonthlySalary, IsActive').is('deleted_at', null).eq('IsActive', true).order('Name'),
            supabase.from('app_settings').select('key, value'),
        ]);
        setEmps(em || []);
        setSettings(Object.fromEntries((st || []).map((r: any) => [r.key, parseFloat(r.value) || 0])));
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const empInsRate = settings.social_insurance_employee ?? 11;
    const erInsRate = settings.social_insurance_employer ?? 18.75;
    const taxRate = settings.income_tax_rate ?? 0;

    const rows = useMemo(() => emps.map(e => {
        const gross = Number(e.MonthlySalary) || 0;
        const empIns = gross * empInsRate / 100;
        const tax = gross * taxRate / 100;
        const net = gross - empIns - tax;
        const erIns = gross * erInsRate / 100;
        return { ...e, gross, empIns, tax, net, erIns, cost: gross + erIns };
    }), [emps, empInsRate, taxRate, erInsRate]);

    const tot = useMemo(() => rows.reduce((a, r) => ({
        gross: a.gross + r.gross, empIns: a.empIns + r.empIns, tax: a.tax + r.tax,
        net: a.net + r.net, erIns: a.erIns + r.erIns, cost: a.cost + r.cost,
    }), { gross: 0, empIns: 0, tax: 0, net: 0, erIns: 0, cost: 0 }), [rows]);

    const money = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

    const postPayroll = async () => {
        if (tot.gross <= 0) return;
        if (!confirm(L(`ترحيل رواتب ${period} محاسبياً؟`, `Post ${period} payroll to accounting?`))) return;
        setPosting(true); setMsg('');
        const ref = `PAY-${period}`;
        const { data: exists } = await supabase.from('journal_entries').select('id').eq('reference', ref).is('deleted_at', null).maybeSingle();
        if (exists) { setPosting(false); setMsg(L('تم ترحيل رواتب هذا الشهر من قبل.', 'This month\'s payroll is already posted.')); return; }
        const { data: d } = await supabase.from('journal_entries').select('entry_number').ilike('entry_number', 'JE-%').order('entry_number', { ascending: false }).limit(1);
        let n = 1; if (d && d.length) { const m = String(d[0].entry_number).match(/JE-(\d+)/); if (m) n = parseInt(m[1]) + 1; }
        const num = `JE-${n.toString().padStart(4, '0')}`;
        const cashAcct = payVia === 'cash' ? '1110' : '1120';
        const { data: entry, error } = await supabase.from('journal_entries').insert([{
            entry_number: num, entry_date: `${period}-28`, description: `رواتب شهر ${period}`, reference: ref, status: 'posted', created_at: new Date().toISOString(),
        }]).select().single();
        if (error || !entry) { setPosting(false); setMsg(error?.message || ''); return; }
        const lines = [
            { account_code: '5200', debit: tot.gross, credit: 0, line_note: 'إجمالي الرواتب', sort_order: 1 },
            { account_code: '5210', debit: tot.erIns, credit: 0, line_note: 'تأمينات (حصة صاحب العمل)', sort_order: 2 },
            { account_code: '2150', debit: 0, credit: tot.empIns + tot.erIns, line_note: 'التأمينات المستحقة', sort_order: 3 },
            { account_code: '2140', debit: 0, credit: tot.tax, line_note: 'ضريبة كسب العمل', sort_order: 4 },
            { account_code: cashAcct, debit: 0, credit: tot.net, line_note: 'صافي المدفوع', sort_order: 5 },
        ].filter(l => l.debit > 0 || l.credit > 0);
        const { error: le } = await supabase.from('journal_lines').insert(lines.map(l => ({ ...l, entry_id: entry.id })));
        setPosting(false);
        setMsg(le ? le.message : L(`تم ترحيل الرواتب ✓ (قيد ${num})`, `Payroll posted ✓ (${num})`));
    };

    const field = 'px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white text-sm focus:outline-none focus:border-gold';

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#DBA935]">{L('الرواتب والأجور', 'Payroll')}</h1>
                        <p className="text-[#C0C0C0] text-sm mt-1">{L(`التأمينات (موظف ${empInsRate}% / صاحب عمل ${erInsRate}%) وضريبة ${taxRate}% — من الإعدادات`, `Insurance (emp ${empInsRate}% / employer ${erInsRate}%), tax ${taxRate}% — from settings`)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className={field} />
                        <select value={payVia} onChange={e => setPayVia(e.target.value)} className={field}>
                            <option value="bank">{L('من البنك', 'From bank')}</option>
                            <option value="cash">{L('من الخزينة', 'From cash')}</option>
                        </select>
                        <button onClick={postPayroll} disabled={posting || tot.gross <= 0} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm disabled:opacity-50">{posting ? L('جارٍ الترحيل...', 'Posting...') : L('ترحيل الرواتب محاسبياً', 'Post to accounting')}</button>
                    </div>
                </div>
                {msg && <div className="mb-3 text-sm text-gold">{msg}</div>}

                <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                    <table className="w-full text-sm" style={{ minWidth: '820px' }}>
                        <thead><tr className="bg-[#242428] text-[#DBA935]/90">
                            {[L('الموظف', 'Employee'), L('المنصب', 'Position'), L('الراتب الإجمالي', 'Gross'), L('تأمينات الموظف', 'Emp. insurance'), L('الضريبة', 'Tax'), L('الصافي', 'Net'), L('تكلفة صاحب العمل', 'Employer cost')].map((h, i) => <th key={i} className="py-2.5 px-3 text-start font-semibold border-b border-[#DBA935]/20 whitespace-nowrap">{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {loading ? <tr><td colSpan={7} className="text-center py-10 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</td></tr>
                                : rows.length === 0 ? <tr><td colSpan={7} className="text-center py-10 text-[#C0C0C0]">{L('لا يوجد موظفون نشطون برواتب', 'No active salaried employees')}</td></tr>
                                    : rows.map(r => (
                                        <tr key={r.EmployeeID} className="odd:bg-white/[0.02] border-b border-[#3E3B3F]/60 text-white">
                                            <td className="py-2 px-3 whitespace-nowrap">{r.Name}</td>
                                            <td className="py-2 px-3 whitespace-nowrap text-[#C0C0C0]">{r.Position || '—'}</td>
                                            <td className="py-2 px-3 whitespace-nowrap">{money(r.gross)}</td>
                                            <td className="py-2 px-3 whitespace-nowrap text-orange-300">{money(r.empIns)}</td>
                                            <td className="py-2 px-3 whitespace-nowrap text-orange-300">{money(r.tax)}</td>
                                            <td className="py-2 px-3 whitespace-nowrap text-green-400 font-bold">{money(r.net)}</td>
                                            <td className="py-2 px-3 whitespace-nowrap text-[#C0C0C0]">{money(r.cost)}</td>
                                        </tr>
                                    ))}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot><tr className="bg-[#DBA935]/10 text-[#DBA935] font-bold">
                                <td className="py-2.5 px-3" colSpan={2}>{L('الإجمالي', 'Total')}</td>
                                <td className="py-2.5 px-3">{money(tot.gross)}</td>
                                <td className="py-2.5 px-3">{money(tot.empIns)}</td>
                                <td className="py-2.5 px-3">{money(tot.tax)}</td>
                                <td className="py-2.5 px-3">{money(tot.net)}</td>
                                <td className="py-2.5 px-3">{money(tot.cost)}</td>
                            </tr></tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
