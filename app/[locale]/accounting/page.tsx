'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';
import { downloadCsv } from '@/lib/exportCsv';
import DetailModal from '@/components/DetailModal';
import ApprovalPanel from '@/components/ApprovalPanel';

interface Account {
    code: string; name_ar: string; name_en: string | null; type: string;
    parent_code: string | null; is_group: boolean; sort_order: number;
}
interface JLine { account_code: string; debit: string; credit: string; line_note: string; }
interface JEntry {
    id: string; entry_number: string | null; entry_date: string; description: string | null;
    reference: string | null; status: string; deleted_at: string | null;
    journal_lines?: { account_code: string; debit: number; credit: number }[];
}

const TYPE_LABEL: Record<string, { ar: string; en: string }> = {
    asset: { ar: 'أصول', en: 'Assets' }, liability: { ar: 'خصوم', en: 'Liabilities' },
    equity: { ar: 'حقوق ملكية', en: 'Equity' }, revenue: { ar: 'إيرادات', en: 'Revenue' },
    expense: { ar: 'مصروفات', en: 'Expenses' },
};

export default function AccountingPage() {
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [tab, setTab] = useState<'coa' | 'journal' | 'quick' | 'expenses' | 'trial' | 'settings'>('coa');
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [savingSet, setSavingSet] = useState(false);
    const [setMsgTxt, setSetMsgTxt] = useState('');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [entries, setEntries] = useState<JEntry[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [partners, setPartners] = useState<any[]>([]);
    const [emps, setEmps] = useState<any[]>([]);

    // smart (plain-language) entry
    const [qp, setQp] = useState({ tpl: 'partner_took', amount: '', amount2: '', partner: '', employee: '', expenseAcct: '5800', from: 'cash', note: '' });
    const [qpBusy, setQpBusy] = useState(false);
    const [qpMsg, setQpMsg] = useState('');
    const [loading, setLoading] = useState(true);
    const [isCEO, setIsCEO] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);

    // expense form
    const emptyExp = { ExpenseType: '', Amount: '', Date: new Date().toISOString().slice(0, 10), account_code: '5800', PaymentMethod: 'cash', PaidBy: '', ProjectID: '', Status: 'pending', ExpenseNote: '' };
    const [showExp, setShowExp] = useState(false);
    const [expForm, setExpForm] = useState<typeof emptyExp>(emptyExp);
    const [savingExp, setSavingExp] = useState(false);
    const [detail, setDetail] = useState<{ kind: 'journal' | 'expense'; data: any } | null>(null);
    const [expApproval, setExpApproval] = useState<any | null>(null);

    const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
    const [desc, setDesc] = useState('');
    const [reference, setReference] = useState('');
    const [lines, setLines] = useState<JLine[]>([
        { account_code: '', debit: '', credit: '', line_note: '' },
        { account_code: '', debit: '', credit: '', line_note: '' },
    ]);

    const postable = useMemo(() => accounts.filter(a => !a.is_group), [accounts]);
    const acctName = (code: string) => { const a = accounts.find(x => x.code === code); return a ? `${a.code} — ${isAr ? a.name_ar : (a.name_en || a.name_ar)}` : code; };

    const loadJournal = useCallback(async () => {
        let q = supabase.from('journal_entries').select('*, journal_lines(account_code, debit, credit)').order('entry_date', { ascending: false });
        q = showDeleted ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null);
        const { data } = await q;
        setEntries((data as JEntry[]) || []);
    }, [showDeleted]);

    const loadExpenses = useCallback(async () => {
        const { data } = await supabase.from('expenses').select('*').is('deleted_at', null).order('created_at', { ascending: false });
        setExpenses(data || []);
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const [{ data: acc }, { data: pa }, { data: em }] = await Promise.all([
                supabase.from('accounts').select('*').is('deleted_at', null).order('sort_order'),
                supabase.from('partners').select('PartnerID, PartnerName').is('deleted_at', null),
                supabase.from('employees').select('id:EmployeeID, name:Name').is('deleted_at', null).order('Name'),
            ]);
            setAccounts((acc as Account[]) || []);
            setPartners(pa || []);
            setEmps(em || []);
            const { data: st } = await supabase.from('app_settings').select('key, value');
            setSettings(Object.fromEntries((st || []).map((r: any) => [r.key, r.value])));
            await loadJournal();
            await loadExpenses();
            setLoading(false);
        })();
    }, [loadJournal, loadExpenses]);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('users').select('role_key').eq('email', user.email).single();
            setIsCEO((data?.role_key || '').toLowerCase() === 'ceo');
        })();
    }, []);

    const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

    const nextNumber = async (): Promise<string> => {
        const { data } = await supabase.from('journal_entries').select('entry_number').ilike('entry_number', 'JE-%').order('entry_number', { ascending: false }).limit(1);
        let n = 1;
        if (data && data.length) { const m = String(data[0].entry_number).match(/JE-(\d+)/); if (m) n = parseInt(m[1]) + 1; }
        return `JE-${n.toString().padStart(4, '0')}`;
    };

    const openNew = () => {
        setEntryDate(new Date().toISOString().slice(0, 10)); setDesc(''); setReference('');
        setLines([{ account_code: '', debit: '', credit: '', line_note: '' }, { account_code: '', debit: '', credit: '', line_note: '' }]);
        setShowModal(true);
    };

    const saveEntry = async () => {
        const valid = lines.filter(l => l.account_code && ((parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0));
        if (!balanced || valid.length < 2) return;
        setSaving(true);
        const number = await nextNumber();
        const { data: { user } } = await supabase.auth.getUser();
        let createdBy = null;
        if (user) { const { data: u } = await supabase.from('users').select('entity_id').eq('email', user.email).single(); createdBy = u?.entity_id || null; }
        const { data: entry, error } = await supabase.from('journal_entries').insert([{
            entry_number: number, entry_date: entryDate, description: desc || null, reference: reference || null,
            status: 'posted', created_by: createdBy, created_at: new Date().toISOString(),
        }]).select().single();
        if (error || !entry) { setSaving(false); alert(error?.message); return; }
        const { error: le } = await supabase.from('journal_lines').insert(
            valid.map((l, i) => ({ entry_id: entry.id, account_code: l.account_code, debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0, line_note: l.line_note || null, sort_order: i + 1 }))
        );
        setSaving(false);
        if (le) { alert(le.message); return; }
        setShowModal(false);
        loadJournal();
    };

    const softDelete = async (id: string) => {
        if (!confirm(L('نقل القيد للمحذوفات؟', 'Move entry to trash?'))) return;
        await supabase.from('journal_entries').update({ deleted_at: new Date().toISOString() }).eq('id', id);
        loadJournal();
    };
    const restore = async (id: string) => { await supabase.from('journal_entries').update({ deleted_at: null }).eq('id', id); loadJournal(); };
    const hardDelete = async (id: string) => {
        if (!confirm(L('حذف نهائي لا يمكن التراجع عنه. متأكد؟', 'Permanent delete cannot be undone. Sure?'))) return;
        const { error } = await supabase.from('journal_entries').delete().eq('id', id);
        if (error) alert(error.message); else loadJournal();
    };

    // accounts usable as expense debit (expenses + fixed-asset purchases)
    const expenseAccounts = useMemo(() => accounts.filter(a => !a.is_group && (a.type === 'expense' || a.type === 'asset')), [accounts]);

    const nextExpId = async (): Promise<string> => {
        const { data } = await supabase.from('expenses').select('ExpenseID').ilike('ExpenseID', 'EXP-%').order('ExpenseID', { ascending: false }).limit(1);
        let n = 1;
        if (data && data.length) { const m = String((data[0] as any).ExpenseID).match(/EXP-(\d+)/); if (m) n = parseInt(m[1]) + 1; }
        return `EXP-${n.toString().padStart(4, '0')}`;
    };

    const saveExpense = async () => {
        if (!expForm.ExpenseType.trim() || !(parseFloat(expForm.Amount) > 0)) return;
        setSavingExp(true);
        const payload: any = {
            ExpenseID: await nextExpId(),
            ExpenseType: expForm.ExpenseType.trim(),
            Amount: parseFloat(expForm.Amount),
            Date: expForm.Date || null,
            account_code: expForm.account_code,
            PaymentMethod: expForm.PaymentMethod,
            PaidBy: expForm.PaidBy || null,
            ProjectID: expForm.ProjectID || null,
            Status: expForm.Status,
            ExpenseNote: expForm.ExpenseNote || null,
            created_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('expenses').insert([payload]);
        setSavingExp(false);
        if (error) { alert(error.message); return; }
        setShowExp(false); setExpForm(emptyExp); loadExpenses(); loadJournal();
    };

    const setExpenseStatus = async (id: string, status: string) => {
        await supabase.from('expenses').update({ Status: status, updated_at: new Date().toISOString() }).eq('ExpenseID', id);
        loadExpenses(); loadJournal();
    };
    const delExpense = async (id: string) => {
        if (!confirm(L('نقل المصروف للمحذوفات؟', 'Move expense to trash?'))) return;
        await supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('ExpenseID', id);
        loadExpenses();
    };

    // Trial balance from posted, non-deleted entries
    const trial = useMemo(() => {
        const map: Record<string, { debit: number; credit: number }> = {};
        entries.filter(e => !e.deleted_at && e.status === 'posted').forEach(e => {
            (e.journal_lines || []).forEach(l => {
                if (!map[l.account_code]) map[l.account_code] = { debit: 0, credit: 0 };
                map[l.account_code].debit += Number(l.debit) || 0;
                map[l.account_code].credit += Number(l.credit) || 0;
            });
        });
        const rows = Object.entries(map).map(([code, v]) => ({ code, ...v, balance: v.debit - v.credit }));
        rows.sort((a, b) => a.code.localeCompare(b.code));
        return { rows, totalDebit: rows.reduce((s, r) => s + r.debit, 0), totalCredit: rows.reduce((s, r) => s + r.credit, 0) };
    }, [entries]);

    const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const field = 'w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white placeholder-silver/50 focus:outline-none focus:border-gold text-sm';

    // ═══ Smart (plain-language) templates → balanced double-entry ═══
    const TEMPLATES: { key: string; ar: string; en: string }[] = [
        { key: 'partner_took', ar: 'شريك حصّل فلوس من عميل وخدها على حسابه (مقابل أرباحه)', en: 'Partner kept collected cash (against his profit)' },
        { key: 'collect_cash', ar: 'تحصيل نقدي من عميل', en: 'Collect cash from a client' },
        { key: 'give_custody', ar: 'صرف عهدة / سلفة لموظف', en: 'Give custody/advance to an employee' },
        { key: 'settle_custody', ar: 'تسوية عهدة موظف (اشترى بند + رجّع الباقي)', en: 'Settle employee custody (spent + returned)' },
        { key: 'deduct_salary', ar: 'خصم مبلغ من راتب موظف (تسوية مستحق عليه)', en: 'Deduct an amount from an employee salary' },
        { key: 'pay_expense', ar: 'دفع مصروف', en: 'Pay an expense' },
        { key: 'deposit_bank', ar: 'إيداع نقدية في البنك', en: 'Deposit cash into the bank' },
    ];
    const fromAcct = () => (qp.from === 'bank' ? '1120' : '1110');
    const partnerName = () => partners.find(p => p.PartnerID === qp.partner)?.PartnerName || '';
    const empName2 = () => emps.find(e => e.id === qp.employee)?.name || '';

    // returns { lines:[{account_code,debit,credit,note}], description } or null if incomplete
    const buildQuick = (): { lines: any[]; description: string } | null => {
        const a = parseFloat(qp.amount) || 0;
        const a2 = parseFloat(qp.amount2) || 0;
        switch (qp.tpl) {
            case 'partner_took':
                if (!qp.partner || a <= 0) return null;
                return { description: `الشريك ${partnerName()} حصّل ${a} وخُصمت على حسابه مقابل أرباحه${qp.note ? ' — ' + qp.note : ''}`,
                    lines: [{ account_code: '3300', debit: a, credit: 0, note: 'جاري الشريك ' + partnerName() }, { account_code: '1130', debit: 0, credit: a, note: 'تحصيل من عميل' }] };
            case 'collect_cash':
                if (a <= 0) return null;
                return { description: `تحصيل نقدي من عميل${qp.note ? ' — ' + qp.note : ''}`,
                    lines: [{ account_code: fromAcct(), debit: a, credit: 0, note: 'تحصيل' }, { account_code: '1130', debit: 0, credit: a, note: 'العملاء' }] };
            case 'give_custody':
                if (!qp.employee || a <= 0) return null;
                return { description: `صرف عهدة ${a} للموظف ${empName2()}${qp.note ? ' — ' + qp.note : ''}`,
                    lines: [{ account_code: '1150', debit: a, credit: 0, note: 'عهدة ' + empName2() }, { account_code: fromAcct(), debit: 0, credit: a, note: 'صرف نقدي' }] };
            case 'settle_custody': {
                const spent = a, returned = a2;
                if (spent <= 0 && returned <= 0) return null;
                const lines: any[] = [];
                if (spent > 0) lines.push({ account_code: qp.expenseAcct, debit: spent, credit: 0, note: 'مصروف من العهدة' });
                if (returned > 0) lines.push({ account_code: fromAcct(), debit: returned, credit: 0, note: 'مرتجع العهدة' });
                lines.push({ account_code: '1150', debit: 0, credit: spent + returned, note: 'تسوية عهدة ' + empName2() });
                return { description: `تسوية عهدة ${empName2()}: مصروفات ${spent} ومرتجع ${returned}${qp.note ? ' — ' + qp.note : ''}`, lines };
            }
            case 'deduct_salary':
                if (!qp.employee || a <= 0) return null;
                return { description: `خصم ${a} من راتب ${empName2()} لتسوية مستحق عليه${qp.note ? ' — ' + qp.note : ''}`,
                    lines: [{ account_code: '5200', debit: a, credit: 0, note: 'رواتب' }, { account_code: '1150', debit: 0, credit: a, note: 'تسوية عهدة/مستحق ' + empName2() }] };
            case 'pay_expense':
                if (a <= 0) return null;
                return { description: `دفع مصروف${qp.note ? ' — ' + qp.note : ''}`,
                    lines: [{ account_code: qp.expenseAcct, debit: a, credit: 0, note: 'مصروف' }, { account_code: fromAcct(), debit: 0, credit: a, note: 'سداد' }] };
            case 'deposit_bank':
                if (a <= 0) return null;
                return { description: `إيداع نقدية في البنك${qp.note ? ' — ' + qp.note : ''}`,
                    lines: [{ account_code: '1120', debit: a, credit: 0, note: 'البنك' }, { account_code: '1110', debit: 0, credit: a, note: 'الخزينة' }] };
            default: return null;
        }
    };
    const quickPreview = buildQuick();

    const postQuick = async () => {
        const built = buildQuick();
        if (!built) return;
        setQpBusy(true); setQpMsg('');
        const number = await nextNumber();
        const { data: entry, error } = await supabase.from('journal_entries').insert([{
            entry_number: number, entry_date: new Date().toISOString().slice(0, 10), description: built.description,
            reference: qp.tpl, status: 'posted', created_at: new Date().toISOString(),
        }]).select().single();
        if (error || !entry) { setQpBusy(false); setQpMsg(error?.message || ''); return; }
        const { error: le } = await supabase.from('journal_lines').insert(
            built.lines.map((l, i) => ({ entry_id: entry.id, account_code: l.account_code, debit: l.debit, credit: l.credit, line_note: l.note, sort_order: i + 1 }))
        );
        setQpBusy(false);
        if (le) { setQpMsg(le.message); return; }
        setQp({ ...qp, amount: '', amount2: '', note: '' });
        setQpMsg(L('تم التسجيل والترحيل ✓', 'Recorded & posted ✓'));
        loadJournal();
    };

    // ═══ finance/HR settings (rates) ═══
    const SETTING_FIELDS: { key: string; ar: string; en: string }[] = [
        { key: 'vat_rate', ar: 'ضريبة القيمة المضافة %', en: 'VAT %' },
        { key: 'income_tax_rate', ar: 'ضريبة الدخل/الأرباح %', en: 'Income tax %' },
        { key: 'social_insurance_employer', ar: 'التأمينات (حصة صاحب العمل) %', en: 'Social insurance (employer) %' },
        { key: 'social_insurance_employee', ar: 'التأمينات (حصة الموظف) %', en: 'Social insurance (employee) %' },
        { key: 'overhead_pct', ar: 'المصاريف غير المباشرة %', en: 'Overhead %' },
        { key: 'target_margin', ar: 'هامش الربح المستهدف %', en: 'Target margin %' },
        { key: 'min_margin', ar: 'أقل هامش ربح %', en: 'Min margin %' },
        { key: 'usd_egp', ar: 'سعر الدولار (ج.م)', en: 'USD rate (EGP)' },
        { key: 'inflation_pct', ar: 'معدل التضخم %', en: 'Inflation %' },
    ];
    const saveSettings = async () => {
        setSavingSet(true); setSetMsgTxt('');
        const rows = SETTING_FIELDS.map(f => ({ key: f.key, value: String(settings[f.key] ?? ''), updated_at: new Date().toISOString() }));
        const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' });
        setSavingSet(false);
        setSetMsgTxt(error ? error.message : L('تم حفظ الإعدادات ✓', 'Settings saved ✓'));
    };

    // ═══ CSV exports (open in Excel) ═══
    const exportTrial = () => downloadCsv(`trial_balance_${new Date().toISOString().slice(0, 10)}`,
        [L('الكود', 'Code'), L('الحساب', 'Account'), L('مدين', 'Debit'), L('دائن', 'Credit'), L('الرصيد', 'Balance')],
        trial.rows.map(r => [r.code, acctName(r.code).replace(/^.*— /, ''), r.debit, r.credit, r.balance]));
    const exportExpenses = () => downloadCsv(`expenses_${new Date().toISOString().slice(0, 10)}`,
        [L('الكود', 'ID'), L('البند', 'Type'), L('الحساب', 'Account'), L('المبلغ', 'Amount'), L('طريقة الدفع', 'Method'), L('التاريخ', 'Date'), L('الحالة', 'Status')],
        expenses.map((e: any) => [e.ExpenseID, e.ExpenseType, e.account_code, e.Amount, e.PaymentMethod, e.Date, e.Status]));
    const exportJournal = () => {
        const rows: any[][] = [];
        entries.filter(e => !e.deleted_at).forEach(e => (e.journal_lines || []).forEach(l => {
            rows.push([e.entry_number, e.entry_date, e.description, e.reference, l.account_code, acctName(l.account_code).replace(/^.*— /, ''), l.debit, l.credit]);
        }));
        downloadCsv(`journal_${new Date().toISOString().slice(0, 10)}`,
            [L('رقم القيد', 'Entry'), L('التاريخ', 'Date'), L('البيان', 'Description'), L('المرجع', 'Ref'), L('الكود', 'Code'), L('الحساب', 'Account'), L('مدين', 'Debit'), L('دائن', 'Credit')], rows);
    };

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <h1 className="text-2xl font-bold text-[#DBA935]">{L('الحسابات والمالية', 'Accounting & Finance')}</h1>
                    {tab === 'journal' && (
                        <div className="flex gap-2">
                            <button onClick={exportJournal} className="px-4 py-2 rounded-xl bg-white/5 text-[#C0C0C0] border border-silver/20 hover:bg-white/10 transition text-sm">⬇ {L('تصدير Excel', 'Export Excel')}</button>
                            <button onClick={() => setShowDeleted(v => !v)} className="px-4 py-2 rounded-xl bg-white/5 text-[#C0C0C0] border border-silver/20 hover:bg-white/10 transition text-sm">{showDeleted ? L('المرحّلة', 'Posted') : L('المحذوفات', 'Trash')}</button>
                            {!showDeleted && <button onClick={openNew} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm">{L('+ قيد جديد', '+ New Entry')}</button>}
                        </div>
                    )}
                    {tab === 'expenses' && (
                        <div className="flex gap-2">
                            <button onClick={exportExpenses} className="px-4 py-2 rounded-xl bg-white/5 text-[#C0C0C0] border border-silver/20 hover:bg-white/10 transition text-sm">⬇ {L('تصدير Excel', 'Export Excel')}</button>
                            <button onClick={() => { setExpForm(emptyExp); setShowExp(true); }} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm">{L('+ مصروف جديد', '+ New Expense')}</button>
                        </div>
                    )}
                    {tab === 'trial' && <button onClick={exportTrial} className="px-4 py-2 rounded-xl bg-white/5 text-[#C0C0C0] border border-silver/20 hover:bg-white/10 transition text-sm">⬇ {L('تصدير Excel', 'Export Excel')}</button>}
                </div>

                <div className="flex gap-2 mb-4 flex-wrap">
                    {([['coa', L('شجرة الحسابات', 'Chart of Accounts')], ['quick', L('تسجيل مبسّط', 'Smart Entry')], ['journal', L('القيود اليومية', 'Journal')], ['expenses', L('المصروفات', 'Expenses')], ['trial', L('ميزان المراجعة', 'Trial Balance')], ['settings', L('الإعدادات', 'Settings')]] as const).map(([k, lab]) => (
                        <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === k ? 'bg-[#DBA935] text-[#3E3B3F]' : 'bg-white/5 text-[#C0C0C0] hover:bg-white/10'}`}>{lab}</button>
                    ))}
                </div>

                {loading ? <div className="text-center py-10 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</div> : (
                    <>
                        {/* ── Chart of accounts ── */}
                        {tab === 'coa' && (
                            <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                                <table className="w-full text-sm" style={{ minWidth: '560px' }}>
                                    <thead><tr className="bg-[#242428] text-[#DBA935]/90">
                                        {[L('الكود', 'Code'), L('الاسم', 'Name'), L('النوع', 'Type')].map((h, i) => <th key={i} className="py-2.5 px-3 text-start font-semibold border-b border-[#DBA935]/20">{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {accounts.map(a => (
                                            <tr key={a.code} className={`border-b border-[#3E3B3F]/60 ${a.is_group ? 'bg-[#DBA935]/5 font-semibold text-[#DBA935]' : 'text-white'}`}>
                                                <td className="py-2 px-3 whitespace-nowrap" dir="ltr">{a.code}</td>
                                                <td className="py-2 px-3" style={{ paddingInlineStart: `${(a.code.length - 2) * 8 + 12}px` }}>{isAr ? a.name_ar : (a.name_en || a.name_ar)}</td>
                                                <td className="py-2 px-3 whitespace-nowrap text-[#C0C0C0]">{isAr ? TYPE_LABEL[a.type]?.ar : TYPE_LABEL[a.type]?.en}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ── Smart (plain-language) entry ── */}
                        {tab === 'quick' && (
                            <div className="max-w-3xl">
                                <p className="text-[#C0C0C0] text-sm mb-4">{L('اختر نوع العملية بالعامية، اكتب المبلغ والأسماء، والنظام يحوّلها لقيد محاسبي صحيح تلقائياً (مدين/دائن) ويرحّلها.', 'Pick the operation in plain words; the system turns it into a correct, balanced journal entry automatically.')}</p>

                                <label className="block text-silver mb-1 text-sm">{L('نوع العملية', 'Operation')}</label>
                                <select value={qp.tpl} onChange={e => setQp({ ...qp, tpl: e.target.value, amount: '', amount2: '', note: '' })} className={`${field} mb-4`}>
                                    {TEMPLATES.map(t => <option key={t.key} value={t.key}>{isAr ? t.ar : t.en}</option>)}
                                </select>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {(qp.tpl === 'partner_took') && (
                                        <div><label className="block text-silver mb-1 text-xs">{L('الشريك', 'Partner')}</label>
                                            <select value={qp.partner} onChange={e => setQp({ ...qp, partner: e.target.value })} className={field}><option value="">{L('— اختر —', '— select —')}</option>{partners.map(p => <option key={p.PartnerID} value={p.PartnerID}>{p.PartnerName}</option>)}</select></div>
                                    )}
                                    {(qp.tpl === 'give_custody' || qp.tpl === 'settle_custody' || qp.tpl === 'deduct_salary') && (
                                        <div><label className="block text-silver mb-1 text-xs">{L('الموظف', 'Employee')}</label>
                                            <select value={qp.employee} onChange={e => setQp({ ...qp, employee: e.target.value })} className={field}><option value="">{L('— اختر —', '— select —')}</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
                                    )}
                                    {qp.tpl !== 'settle_custody' && (
                                        <div><label className="block text-silver mb-1 text-xs">{qp.tpl === 'deduct_salary' ? L('المبلغ المخصوم', 'Amount deducted') : L('المبلغ', 'Amount')}</label>
                                            <input type="number" value={qp.amount} onChange={e => setQp({ ...qp, amount: e.target.value })} className={field} dir="ltr" /></div>
                                    )}
                                    {qp.tpl === 'settle_custody' && (<>
                                        <div><label className="block text-silver mb-1 text-xs">{L('المبلغ المصروف (اشترى بيه)', 'Spent amount')}</label><input type="number" value={qp.amount} onChange={e => setQp({ ...qp, amount: e.target.value })} className={field} dir="ltr" /></div>
                                        <div><label className="block text-silver mb-1 text-xs">{L('المبلغ المرتجع', 'Returned amount')}</label><input type="number" value={qp.amount2} onChange={e => setQp({ ...qp, amount2: e.target.value })} className={field} dir="ltr" /></div>
                                    </>)}
                                    {(qp.tpl === 'pay_expense' || qp.tpl === 'settle_custody') && (
                                        <div><label className="block text-silver mb-1 text-xs">{L('حساب المصروف', 'Expense account')}</label>
                                            <select value={qp.expenseAcct} onChange={e => setQp({ ...qp, expenseAcct: e.target.value })} className={field}>{expenseAccounts.map(a => <option key={a.code} value={a.code}>{a.code} — {isAr ? a.name_ar : (a.name_en || a.name_ar)}</option>)}</select></div>
                                    )}
                                    {(qp.tpl === 'collect_cash' || qp.tpl === 'give_custody' || qp.tpl === 'settle_custody' || qp.tpl === 'pay_expense') && (
                                        <div><label className="block text-silver mb-1 text-xs">{L('من/إلى', 'Cash or Bank')}</label>
                                            <select value={qp.from} onChange={e => setQp({ ...qp, from: e.target.value })} className={field}><option value="cash">{L('الخزينة (نقدي)', 'Cash')}</option><option value="bank">{L('البنك', 'Bank')}</option></select></div>
                                    )}
                                    <div className="sm:col-span-2"><label className="block text-silver mb-1 text-xs">{L('ملاحظة', 'Note')}</label><input value={qp.note} onChange={e => setQp({ ...qp, note: e.target.value })} className={field} /></div>
                                </div>

                                {/* live preview of the resulting entry */}
                                <div className="mt-4 bg-black/30 rounded-xl border border-gold/20 p-4">
                                    <p className="text-gold text-sm font-semibold mb-2">{L('القيد الناتج', 'Resulting entry')}</p>
                                    {quickPreview ? (
                                        <table className="w-full text-sm">
                                            <thead><tr className="text-[#DBA935]/80 text-xs"><th className="text-start py-1">{L('الحساب', 'Account')}</th><th className="text-start py-1">{L('مدين', 'Debit')}</th><th className="text-start py-1">{L('دائن', 'Credit')}</th></tr></thead>
                                            <tbody>
                                                {quickPreview.lines.map((l, i) => (
                                                    <tr key={i} className="text-white border-t border-silver/10"><td className="py-1">{acctName(l.account_code)}</td><td className="py-1">{l.debit ? fmt(l.debit) : ''}</td><td className="py-1">{l.credit ? fmt(l.credit) : ''}</td></tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : <p className="text-silver/60 text-sm">{L('أكمل البيانات لعرض القيد', 'Fill the fields to preview the entry')}</p>}
                                </div>

                                {qpMsg && <div className="mt-3 text-sm text-gold">{qpMsg}</div>}
                                <button onClick={postQuick} disabled={qpBusy || !quickPreview} className="mt-4 px-6 py-2.5 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition disabled:opacity-50 text-sm">{qpBusy ? L('جارٍ التسجيل...', 'Posting...') : L('سجّل ورحّل', 'Record & post')}</button>
                            </div>
                        )}

                        {/* ── Journal ── */}
                        {tab === 'journal' && (
                            <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                                <table className="w-full text-sm" style={{ minWidth: '760px' }}>
                                    <thead><tr className="bg-[#242428] text-[#DBA935]/90">
                                        {[L('الرقم', 'No.'), L('التاريخ', 'Date'), L('البيان', 'Description'), L('مرجع', 'Ref'), L('مدين', 'Debit'), L('دائن', 'Credit'), L('الإجراءات', 'Actions')].map((h, i) => <th key={i} className="py-2.5 px-3 text-start font-semibold border-b border-[#DBA935]/20 whitespace-nowrap">{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {entries.length === 0 ? <tr><td colSpan={7} className="text-center py-10 text-[#C0C0C0]">{L('لا توجد قيود', 'No entries')}</td></tr>
                                            : entries.map(e => {
                                                const d = (e.journal_lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
                                                const c = (e.journal_lines || []).reduce((s, l) => s + (Number(l.credit) || 0), 0);
                                                return (
                                                    <tr key={e.id} className="odd:bg-white/[0.02] border-b border-[#3E3B3F]/60 text-white">
                                                        <td className="py-2.5 px-3 whitespace-nowrap text-[#DBA935] font-medium" dir="ltr">{e.entry_number}</td>
                                                        <td className="py-2.5 px-3 whitespace-nowrap">{e.entry_date}</td>
                                                        <td className="py-2.5 px-3">{e.description || '—'}</td>
                                                        <td className="py-2.5 px-3 whitespace-nowrap">{e.reference || '—'}</td>
                                                        <td className="py-2.5 px-3 whitespace-nowrap">{fmt(d)}</td>
                                                        <td className="py-2.5 px-3 whitespace-nowrap">{fmt(c)}</td>
                                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                                            <span className="inline-flex items-center gap-3">
                                                                {showDeleted ? (<>
                                                                    <button onClick={() => restore(e.id)} className="text-green-400 hover:underline">{L('استعادة', 'Restore')}</button>
                                                                    {isCEO && <button onClick={() => hardDelete(e.id)} className="text-red-700 hover:text-red-500 font-semibold">{L('حذف نهائي', 'Delete forever')}</button>}
                                                                </>) : (<>
                                                                    <button onClick={() => setDetail({ kind: 'journal', data: e })} className="text-[#C0C0C0] hover:text-white hover:underline">{L('تفاصيل', 'Details')}</button>
                                                                    <button onClick={() => softDelete(e.id)} className="text-red-400 hover:underline">{L('حذف', 'Delete')}</button>
                                                                </>)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ── Expenses ── */}
                        {tab === 'expenses' && (
                            <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                                <table className="w-full text-sm" style={{ minWidth: '840px' }}>
                                    <thead><tr className="bg-[#242428] text-[#DBA935]/90">
                                        {[L('الكود', 'ID'), L('البند', 'Type'), L('الحساب', 'Account'), L('المبلغ', 'Amount'), L('طريقة الدفع', 'Method'), L('التاريخ', 'Date'), L('الحالة', 'Status'), L('الإجراءات', 'Actions')].map((h, i) => <th key={i} className="py-2.5 px-3 text-start font-semibold border-b border-[#DBA935]/20 whitespace-nowrap">{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {expenses.length === 0 ? <tr><td colSpan={8} className="text-center py-10 text-[#C0C0C0]">{L('لا توجد مصروفات', 'No expenses')}</td></tr>
                                            : expenses.map((e: any) => (
                                                <tr key={e.ExpenseID} className="odd:bg-white/[0.02] border-b border-[#3E3B3F]/60 text-white">
                                                    <td className="py-2.5 px-3 whitespace-nowrap text-[#DBA935]" dir="ltr">{e.ExpenseID}</td>
                                                    <td className="py-2.5 px-3">{e.ExpenseType}</td>
                                                    <td className="py-2.5 px-3 whitespace-nowrap text-xs text-[#C0C0C0]">{acctName(e.account_code)}</td>
                                                    <td className="py-2.5 px-3 whitespace-nowrap">{fmt(e.Amount)}</td>
                                                    <td className="py-2.5 px-3 whitespace-nowrap">{e.PaymentMethod || '—'}</td>
                                                    <td className="py-2.5 px-3 whitespace-nowrap">{e.Date || '—'}</td>
                                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                                        <select value={e.Status || 'pending'} onChange={ev => setExpenseStatus(e.ExpenseID, ev.target.value)} className={`${field} py-1`}>
                                                            <option value="pending">{L('معلّق', 'Pending')}</option>
                                                            <option value="approved">{L('معتمد', 'Approved')}</option>
                                                            <option value="paid">{L('مدفوع (يُرحَّل)', 'Paid (posts)')}</option>
                                                        </select>
                                                    </td>
                                                    <td className="py-2.5 px-3 whitespace-nowrap"><span className="inline-flex items-center gap-3"><button onClick={() => setExpApproval(e)} className="text-[#DBA935] hover:underline text-xs">{L('اعتماد', 'Approvals')}</button><button onClick={() => setDetail({ kind: 'expense', data: e })} className="text-[#C0C0C0] hover:text-white hover:underline text-xs">{L('تفاصيل', 'Details')}</button><button onClick={() => delExpense(e.ExpenseID)} className="text-red-400 hover:underline text-xs">{L('حذف', 'Delete')}</button></span></td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ── Settings (rates) ── */}
                        {tab === 'settings' && (
                            <div className="max-w-2xl">
                                <p className="text-[#C0C0C0] text-sm mb-4">{L('النِسب الأساسية للمالية والتأمينات والتسعير. تُستخدم كقيم افتراضية في المستندات والمشاريع.', 'Core finance/insurance/pricing rates, used as defaults across documents and projects.')}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {SETTING_FIELDS.map(f => (
                                        <div key={f.key}>
                                            <label className="block text-silver mb-1 text-xs">{isAr ? f.ar : f.en}</label>
                                            <input type="number" step="0.01" value={settings[f.key] ?? ''} onChange={e => setSettings({ ...settings, [f.key]: e.target.value })} className={field} dir="ltr" />
                                        </div>
                                    ))}
                                </div>
                                {setMsgTxt && <div className="mt-3 text-sm text-gold">{setMsgTxt}</div>}
                                <button onClick={saveSettings} disabled={savingSet} className="mt-4 px-6 py-2.5 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition disabled:opacity-50 text-sm">{savingSet ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ الإعدادات', 'Save settings')}</button>
                            </div>
                        )}

                        {/* ── Trial balance ── */}
                        {tab === 'trial' && (
                            <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                                <table className="w-full text-sm" style={{ minWidth: '560px' }}>
                                    <thead><tr className="bg-[#242428] text-[#DBA935]/90">
                                        {[L('الحساب', 'Account'), L('مدين', 'Debit'), L('دائن', 'Credit'), L('الرصيد', 'Balance')].map((h, i) => <th key={i} className="py-2.5 px-3 text-start font-semibold border-b border-[#DBA935]/20">{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {trial.rows.length === 0 ? <tr><td colSpan={4} className="text-center py-10 text-[#C0C0C0]">{L('لا توجد بيانات', 'No data')}</td></tr>
                                            : trial.rows.map(r => (
                                                <tr key={r.code} className="odd:bg-white/[0.02] border-b border-[#3E3B3F]/60 text-white">
                                                    <td className="py-2 px-3">{acctName(r.code)}</td>
                                                    <td className="py-2 px-3 whitespace-nowrap">{fmt(r.debit)}</td>
                                                    <td className="py-2 px-3 whitespace-nowrap">{fmt(r.credit)}</td>
                                                    <td className={`py-2 px-3 whitespace-nowrap ${r.balance >= 0 ? 'text-green-400' : 'text-orange-400'}`}>{fmt(Math.abs(r.balance))} {r.balance >= 0 ? L('مدين', 'Dr') : L('دائن', 'Cr')}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                    {trial.rows.length > 0 && (
                                        <tfoot><tr className="bg-[#DBA935]/10 text-[#DBA935] font-bold">
                                            <td className="py-2.5 px-3">{L('الإجمالي', 'Total')}</td>
                                            <td className="py-2.5 px-3">{fmt(trial.totalDebit)}</td>
                                            <td className="py-2.5 px-3">{fmt(trial.totalCredit)}</td>
                                            <td className="py-2.5 px-3">{Math.abs(trial.totalDebit - trial.totalCredit) < 0.005 ? L('متوازن ✓', 'Balanced ✓') : L('غير متوازن', 'Unbalanced')}</td>
                                        </tr></tfoot>
                                    )}
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Journal entry modal ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowModal(false)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]">
                            <h2 className="text-lg font-alata text-gold">{L('قيد يومية جديد', 'New Journal Entry')}</h2>
                            <button onClick={() => setShowModal(false)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div><label className="block text-silver mb-1 text-xs">{L('التاريخ', 'Date')}</label><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={field} /></div>
                                <div><label className="block text-silver mb-1 text-xs">{L('البيان', 'Description')}</label><input value={desc} onChange={e => setDesc(e.target.value)} className={field} /></div>
                                <div><label className="block text-silver mb-1 text-xs">{L('مرجع', 'Reference')}</label><input value={reference} onChange={e => setReference(e.target.value)} className={field} placeholder={L('رقم فاتورة...', 'Invoice no...')} /></div>
                            </div>

                            <div className="space-y-2">
                                {lines.map((l, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                        <select value={l.account_code} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, account_code: e.target.value } : x))} className={`col-span-5 ${field}`}>
                                            <option value="">{L('— الحساب —', '— account —')}</option>
                                            {postable.map(a => <option key={a.code} value={a.code}>{a.code} — {isAr ? a.name_ar : (a.name_en || a.name_ar)}</option>)}
                                        </select>
                                        <input type="number" placeholder={L('مدين', 'Debit')} value={l.debit} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, debit: e.target.value, credit: e.target.value ? '' : x.credit } : x))} className={`col-span-3 ${field}`} dir="ltr" />
                                        <input type="number" placeholder={L('دائن', 'Credit')} value={l.credit} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, credit: e.target.value, debit: e.target.value ? '' : x.debit } : x))} className={`col-span-3 ${field}`} dir="ltr" />
                                        <button onClick={() => setLines(ls => ls.length > 2 ? ls.filter((_, j) => j !== i) : ls)} className="col-span-1 text-red-400 hover:text-red-300">✕</button>
                                    </div>
                                ))}
                                <button onClick={() => setLines(ls => [...ls, { account_code: '', debit: '', credit: '', line_note: '' }])} className="text-[#DBA935] text-sm hover:underline">+ {L('سطر', 'Line')}</button>
                            </div>

                            <div className="flex justify-between items-center text-sm border-t border-silver/20 pt-3">
                                <span className="text-silver">{L('مدين', 'Debit')}: <span className="text-white font-bold">{fmt(totalDebit)}</span></span>
                                <span className="text-silver">{L('دائن', 'Credit')}: <span className="text-white font-bold">{fmt(totalCredit)}</span></span>
                                <span className={balanced ? 'text-green-400 font-bold' : 'text-orange-400 font-bold'}>{balanced ? L('متوازن ✓', 'Balanced ✓') : L('غير متوازن', 'Unbalanced')}</span>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={saveEntry} disabled={saving || !balanced} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold hover:bg-yellow-600 transition disabled:opacity-50">{saving ? L('جارٍ الترحيل...', 'Posting...') : L('ترحيل القيد', 'Post entry')}</button>
                                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-silver/10 rounded-lg text-silver hover:bg-silver/20 transition">{L('إلغاء', 'Cancel')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Expense modal ── */}
            {showExp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowExp(false)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]">
                            <h2 className="text-lg font-alata text-gold">{L('مصروف جديد', 'New Expense')}</h2>
                            <button onClick={() => setShowExp(false)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2"><label className="block text-silver mb-1 text-xs">{L('بند المصروف', 'Expense type')} *</label><input value={expForm.ExpenseType} onChange={e => setExpForm({ ...expForm, ExpenseType: e.target.value })} className={field} placeholder={L('مثال: إيجار المقر / بنزين سيارة', 'e.g. office rent')} /></div>
                            <div><label className="block text-silver mb-1 text-xs">{L('المبلغ', 'Amount')} *</label><input type="number" value={expForm.Amount} onChange={e => setExpForm({ ...expForm, Amount: e.target.value })} className={field} dir="ltr" /></div>
                            <div><label className="block text-silver mb-1 text-xs">{L('التاريخ', 'Date')}</label><input type="date" value={expForm.Date} onChange={e => setExpForm({ ...expForm, Date: e.target.value })} className={field} /></div>
                            <div className="sm:col-span-2"><label className="block text-silver mb-1 text-xs">{L('الحساب (شجرة الحسابات)', 'Account (chart)')}</label>
                                <select value={expForm.account_code} onChange={e => setExpForm({ ...expForm, account_code: e.target.value })} className={field}>
                                    {expenseAccounts.map(a => <option key={a.code} value={a.code}>{a.code} — {isAr ? a.name_ar : (a.name_en || a.name_ar)}</option>)}
                                </select>
                            </div>
                            <div><label className="block text-silver mb-1 text-xs">{L('طريقة الدفع', 'Payment method')}</label>
                                <select value={expForm.PaymentMethod} onChange={e => setExpForm({ ...expForm, PaymentMethod: e.target.value })} className={field}>
                                    <option value="cash">{L('نقدي (الخزينة)', 'Cash')}</option>
                                    <option value="bank_transfer">{L('تحويل بنكي', 'Bank transfer')}</option>
                                    <option value="instapay">{L('انستاباي', 'Instapay')}</option>
                                    <option value="cheque">{L('شيك', 'Cheque')}</option>
                                </select>
                            </div>
                            <div><label className="block text-silver mb-1 text-xs">{L('الحالة', 'Status')}</label>
                                <select value={expForm.Status} onChange={e => setExpForm({ ...expForm, Status: e.target.value })} className={field}>
                                    <option value="pending">{L('معلّق', 'Pending')}</option>
                                    <option value="approved">{L('معتمد', 'Approved')}</option>
                                    <option value="paid">{L('مدفوع (يُرحَّل محاسبياً)', 'Paid (auto-posts)')}</option>
                                </select>
                            </div>
                            <div><label className="block text-silver mb-1 text-xs">{L('دفع بواسطة', 'Paid by')}</label><input value={expForm.PaidBy} onChange={e => setExpForm({ ...expForm, PaidBy: e.target.value })} className={field} /></div>
                            <div><label className="block text-silver mb-1 text-xs">{L('كود المشروع (اختياري)', 'Project code (optional)')}</label><input value={expForm.ProjectID} onChange={e => setExpForm({ ...expForm, ProjectID: e.target.value })} className={field} placeholder="PRJ-001" dir="ltr" /></div>
                            <div className="sm:col-span-2"><label className="block text-silver mb-1 text-xs">{L('ملاحظات', 'Notes')}</label><textarea value={expForm.ExpenseNote} onChange={e => setExpForm({ ...expForm, ExpenseNote: e.target.value })} rows={2} className={field} /></div>
                            <div className="sm:col-span-2 flex gap-3 pt-2">
                                <button onClick={saveExpense} disabled={savingExp || !expForm.ExpenseType.trim() || !(parseFloat(expForm.Amount) > 0)} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold hover:bg-yellow-600 transition disabled:opacity-50">{savingExp ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ المصروف', 'Save expense')}</button>
                                <button onClick={() => setShowExp(false)} className="flex-1 px-4 py-2 bg-silver/10 rounded-lg text-silver hover:bg-silver/20 transition">{L('إلغاء', 'Cancel')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {detail?.kind === 'journal' && (
                <DetailModal locale={locale} onClose={() => setDetail(null)}
                    title={detail.data.entry_number}
                    subtitle={`${detail.data.entry_date} · ${detail.data.description || ''}`}
                    rows={[
                        { label: L('المرجع', 'Reference'), value: detail.data.reference || '—' },
                        { label: L('الحالة', 'Status'), value: detail.data.status || '—' },
                    ]}>
                    <div className="overflow-x-auto rounded-lg border border-[#3E3B3F]">
                        <table className="w-full text-sm">
                            <thead><tr className="bg-[#242428] text-[#DBA935]/90">
                                {[L('الحساب', 'Account'), L('مدين', 'Debit'), L('دائن', 'Credit')].map((h, i) => <th key={i} className="py-2 px-3 text-start border-b border-[#DBA935]/20">{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {(detail.data.journal_lines || []).map((l: any, i: number) => (
                                    <tr key={i} className="border-b border-[#3E3B3F]/60 text-white">
                                        <td className="py-1.5 px-3">{acctName(l.account_code)}</td>
                                        <td className="py-1.5 px-3">{l.debit ? fmt(l.debit) : ''}</td>
                                        <td className="py-1.5 px-3">{l.credit ? fmt(l.credit) : ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </DetailModal>
            )}
            {detail?.kind === 'expense' && (
                <DetailModal locale={locale} onClose={() => setDetail(null)}
                    title={detail.data.ExpenseType}
                    subtitle={`${detail.data.ExpenseID} · ${detail.data.Date || ''}`}
                    rows={[
                        { label: L('المبلغ', 'Amount'), value: `${fmt(detail.data.Amount)}` },
                        { label: L('الحساب', 'Account'), value: acctName(detail.data.account_code) },
                        { label: L('طريقة الدفع', 'Payment method'), value: detail.data.PaymentMethod || '—' },
                        { label: L('الحالة', 'Status'), value: detail.data.Status || '—' },
                        { label: L('دفع بواسطة', 'Paid by'), value: detail.data.PaidBy || '—' },
                        { label: L('المشروع', 'Project'), value: detail.data.ProjectID || '—' },
                        { label: L('ملاحظات', 'Notes'), value: detail.data.ExpenseNote || '—', full: true },
                    ]}
                />
            )}

            {expApproval && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={() => { setExpApproval(null); loadExpenses(); loadJournal(); }} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-silver/20">
                            <div>
                                <h2 className="text-lg font-alata text-gold">{L('اعتماد مصروف', 'Expense approval')}</h2>
                                <p className="text-silver/70 text-xs mt-0.5">{expApproval.ExpenseType} — {fmt(expApproval.Amount)} {L('ج.م', 'EGP')}</p>
                            </div>
                            <button onClick={() => { setExpApproval(null); loadExpenses(); loadJournal(); }} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-5">
                            <ApprovalPanel entityType="expense" entityId={expApproval.ExpenseID} value={Number(expApproval.Amount) || 0} locale={locale} onStatusChange={() => { loadExpenses(); loadJournal(); }} />
                            <p className="text-silver/50 text-[11px] mt-3">{L('عند اكتمال الاعتماد يتحوّل المصروف إلى «مدفوع» ويُرحَّل محاسبياً تلقائياً.', 'On full approval the expense becomes "paid" and is auto-posted.')}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
