'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';
import DetailModal from '@/components/DetailModal';

interface Employee {
    EmployeeID: string;
    Name: string | null;
    NationalID: string | null;
    Position: string | null;
    Department: string | null;
    JobGrade: string | null;
    MonthlySalary: number | null;
    HourlyRate: number | null;
    WorkEmail: string | null;
    PhoneNumber: string | null;
    StartDate: string | null;
    Gender: string | null;
    Status: string | null;
    IsActive: boolean | null;
    BankAccountNumber: string | null;
    DevelopmentPlan: string | null;
    department_id: string | null;
    position_id: string | null;
    deleted_at: string | null;
}

const emptyForm = {
    EmployeeID: '', Name: '', NationalID: '', Position: '', Department: '', JobGrade: '',
    MonthlySalary: '', HourlyRate: '', WorkEmail: '', PhoneNumber: '', StartDate: '',
    Gender: 'male', Status: 'active', IsActive: true, BankAccountNumber: '', DevelopmentPlan: '',
    department_id: '', position_id: '',
};

export default function EmployeesPage() {
    const router = useRouter();
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [rows, setRows] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<typeof emptyForm>(emptyForm);
    const [search, setSearch] = useState('');
    const [isCEO, setIsCEO] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);
    const [detail, setDetail] = useState<Employee | null>(null);
    const [depts, setDepts] = useState<any[]>([]);
    const [positions, setPositions] = useState<any[]>([]);
    useEffect(() => {
        (async () => {
            const [{ data: d }, { data: p }] = await Promise.all([
                supabase.from('departments').select('id, name_ar, name_en, parent_id').order('sort'),
                supabase.from('positions').select('id, title_ar, title_en, department_id').order('sort'),
            ]);
            setDepts(d || []); setPositions(p || []);
        })();
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('employees').select('*').order('created_at', { ascending: false });
        q = showDeleted ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null);
        const { data } = await q;
        setRows((data as Employee[]) || []);
        setLoading(false);
    }, [showDeleted]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('users').select('role_key').eq('email', user.email).single();
            setIsCEO((data?.role_key || '').toLowerCase() === 'ceo');
        })();
    }, []);

    const filtered = useMemo(() => {
        const s = search.trim().toLowerCase();
        if (!s) return rows;
        return rows.filter(r => [r.Name, r.Position, r.Department, r.PhoneNumber, r.WorkEmail].some(v => (v || '').toLowerCase().includes(s)));
    }, [rows, search]);

    const nextId = async (): Promise<string> => {
        const { data } = await supabase.from('employees').select('EmployeeID').ilike('EmployeeID', 'EMP-%').order('EmployeeID', { ascending: false }).limit(1);
        let n = 1;
        if (data && data.length) { const m = String(data[0].EmployeeID).match(/EMP-(\d+)/); if (m) n = parseInt(m[1]) + 1; }
        return `EMP-${n.toString().padStart(3, '0')}`;
    };

    const openNew = () => { setForm(emptyForm); setShowModal(true); };
    const openEdit = (r: Employee) => {
        setForm({
            EmployeeID: r.EmployeeID, Name: r.Name || '', NationalID: r.NationalID || '', Position: r.Position || '',
            Department: r.Department || '', JobGrade: r.JobGrade || '', MonthlySalary: r.MonthlySalary != null ? String(r.MonthlySalary) : '',
            HourlyRate: r.HourlyRate != null ? String(r.HourlyRate) : '', WorkEmail: r.WorkEmail || '', PhoneNumber: r.PhoneNumber || '',
            StartDate: r.StartDate || '', Gender: r.Gender || 'male', Status: r.Status || 'active', IsActive: r.IsActive ?? true,
            BankAccountNumber: r.BankAccountNumber || '', DevelopmentPlan: r.DevelopmentPlan || '',
            department_id: r.department_id || '', position_id: r.position_id || '',
        });
        setShowModal(true);
    };

    const save = async () => {
        if (!form.Name.trim()) return;
        setSaving(true);
        const payload: any = {
            Name: form.Name.trim(), NationalID: form.NationalID || null, Position: form.Position || null,
            Department: form.Department || null, JobGrade: form.JobGrade || null,
            MonthlySalary: form.MonthlySalary ? parseFloat(form.MonthlySalary) : null,
            HourlyRate: form.HourlyRate ? parseFloat(form.HourlyRate) : null,
            WorkEmail: form.WorkEmail || null, PhoneNumber: form.PhoneNumber || null, StartDate: form.StartDate || null,
            Gender: form.Gender, Status: form.Status, IsActive: form.IsActive,
            BankAccountNumber: form.BankAccountNumber || null, DevelopmentPlan: form.DevelopmentPlan || null,
            department_id: form.department_id || null, position_id: form.position_id || null,
            updated_at: new Date().toISOString(),
        };
        let error;
        if (rows.some(r => r.EmployeeID === form.EmployeeID) && form.EmployeeID) {
            ({ error } = await supabase.from('employees').update(payload).eq('EmployeeID', form.EmployeeID));
        } else {
            payload.EmployeeID = await nextId();
            payload.created_at = new Date().toISOString();
            ({ error } = await supabase.from('employees').insert([payload]));
        }
        setSaving(false);
        if (!error) { setShowModal(false); setForm(emptyForm); load(); } else alert(error.message);
    };

    const softDelete = async (id: string) => {
        if (!confirm(L('نقل الموظف للمحذوفات؟', 'Move employee to trash?'))) return;
        const { error } = await supabase.from('employees').update({ deleted_at: new Date().toISOString() }).eq('EmployeeID', id);
        if (!error) load();
    };
    const restore = async (id: string) => { await supabase.from('employees').update({ deleted_at: null }).eq('EmployeeID', id); load(); };
    const hardDelete = async (id: string) => {
        if (!confirm(L('حذف نهائي لا يمكن التراجع عنه. متأكد؟', 'Permanent delete cannot be undone. Sure?'))) return;
        const { error } = await supabase.from('employees').delete().eq('EmployeeID', id);
        if (!error) load(); else alert(error.message);
    };

    const field = 'w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white placeholder-silver/50 focus:outline-none focus:border-gold transition-all text-sm';
    const lbl = 'block text-silver mb-1 text-xs';

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#DBA935]">{L('الموظفون', 'Employees')}</h1>
                        <p className="text-[#C0C0C0] text-sm mt-1">{L(`إجمالي ${rows.length}`, `${rows.length} total`)}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowDeleted(v => !v)} className="px-4 py-2 rounded-xl bg-white/5 text-[#C0C0C0] border border-silver/20 hover:bg-white/10 transition text-sm">
                            {showDeleted ? L('النشطون', 'Active') : L('المحذوفات', 'Trash')}
                        </button>
                        {!showDeleted && <button onClick={openNew} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm">{L('+ موظف جديد', '+ New Employee')}</button>}
                    </div>
                </div>

                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={L('بحث...', 'Search...')}
                    className="w-full mb-4 px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white placeholder-silver/50 focus:outline-none focus:border-gold text-sm" />

                <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                    <table className="w-full text-sm" style={{ minWidth: '840px' }}>
                        <thead>
                            <tr className="bg-[#242428] text-[#DBA935]/90">
                                {[L('الكود', 'ID'), L('الاسم', 'Name'), L('المنصب', 'Position'), L('القسم', 'Dept'), L('الهاتف', 'Phone'), L('الراتب', 'Salary'), L('الحالة', 'Status'), L('الإجراءات', 'Actions')].map((h, i) => (
                                    <th key={i} className="py-2.5 px-3 text-start font-semibold whitespace-nowrap border-b border-[#DBA935]/20">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan={8} className="text-center py-10 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</td></tr>
                                : filtered.length === 0 ? <tr><td colSpan={8} className="text-center py-10 text-[#C0C0C0]">{L('لا يوجد موظفون', 'No employees')}</td></tr>
                                    : filtered.map(r => (
                                        <tr key={r.EmployeeID} className="odd:bg-white/[0.02] hover:bg-[#DBA935]/10 transition border-b border-[#3E3B3F]/60 text-white">
                                            <td className="py-2.5 px-3 whitespace-nowrap text-[#DBA935] font-medium">{r.EmployeeID}</td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">{r.Name || '—'}</td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">{r.Position || '—'}</td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">{r.Department || '—'}</td>
                                            <td className="py-2.5 px-3 whitespace-nowrap" dir="ltr">{r.PhoneNumber || '—'}</td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">{r.MonthlySalary ? Number(r.MonthlySalary).toLocaleString() : '—'}</td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${r.IsActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-300'}`}>{r.IsActive ? L('نشط', 'Active') : L('غير نشط', 'Inactive')}</span>
                                            </td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-3">
                                                    {showDeleted ? (<>
                                                        <button onClick={() => restore(r.EmployeeID)} className="text-green-400 hover:underline">{L('استعادة', 'Restore')}</button>
                                                        {isCEO && <button onClick={() => hardDelete(r.EmployeeID)} className="text-red-700 hover:text-red-500 font-semibold">{L('حذف نهائي', 'Delete forever')}</button>}
                                                    </>) : (<>
                                                        <button onClick={() => setDetail(r)} className="text-[#C0C0C0] hover:text-white hover:underline">{L('تفاصيل', 'Details')}</button>
                                                        <button onClick={() => openEdit(r)} className="text-[#DBA935] hover:underline">{L('تعديل', 'Edit')}</button>
                                                        <button onClick={() => softDelete(r.EmployeeID)} className="text-red-400 hover:underline">{L('حذف', 'Delete')}</button>
                                                    </>)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowModal(false)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]">
                            <h2 className="text-lg font-alata text-gold">{form.EmployeeID ? L('تعديل موظف', 'Edit Employee') : L('موظف جديد', 'New Employee')}</h2>
                            <button onClick={() => setShowModal(false)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2"><label className={lbl}>{L('الاسم', 'Name')} *</label><input value={form.Name} onChange={e => setForm({ ...form, Name: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('الرقم القومي', 'National ID')}</label><input value={form.NationalID} onChange={e => setForm({ ...form, NationalID: e.target.value })} className={field} dir="ltr" /></div>
                            <div><label className={lbl}>{L('المنصب', 'Position')}</label><input value={form.Position} onChange={e => setForm({ ...form, Position: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('الإدارة/القسم (من الهيكل)', 'Department (structure)')}</label>
                                <select value={form.department_id} onChange={e => { const d = depts.find(x => x.id === e.target.value); setForm({ ...form, department_id: e.target.value, position_id: '', Department: d ? (isAr ? d.name_ar : (d.name_en || d.name_ar)) : form.Department }); }} className={field}>
                                    <option value="">{L('— اختر —', '— select —')}</option>
                                    {depts.map(d => <option key={d.id} value={d.id}>{(isAr ? d.name_ar : (d.name_en || d.name_ar))}{d.parent_id ? ` (${isAr ? (depts.find(x => x.id === d.parent_id)?.name_ar || '') : (depts.find(x => x.id === d.parent_id)?.name_en || '')})` : ''}</option>)}
                                </select>
                            </div>
                            <div><label className={lbl}>{L('المنصب (من الهيكل)', 'Position (structure)')}</label>
                                <select value={form.position_id} onChange={e => { const p = positions.find(x => x.id === e.target.value); setForm({ ...form, position_id: e.target.value, Position: p ? (isAr ? p.title_ar : (p.title_en || p.title_ar)) : form.Position }); }} className={field}>
                                    <option value="">{L('— اختر —', '— select —')}</option>
                                    {positions.filter(p => !form.department_id || p.department_id === form.department_id).map(p => <option key={p.id} value={p.id}>{isAr ? p.title_ar : (p.title_en || p.title_ar)}</option>)}
                                </select>
                            </div>
                            <div><label className={lbl}>{L('الدرجة الوظيفية', 'Job grade')}</label><input value={form.JobGrade} onChange={e => setForm({ ...form, JobGrade: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('الراتب الشهري', 'Monthly salary')}</label><input type="number" value={form.MonthlySalary} onChange={e => setForm({ ...form, MonthlySalary: e.target.value })} className={field} dir="ltr" /></div>
                            <div><label className={lbl}>{L('أجر الساعة', 'Hourly rate')}</label><input type="number" value={form.HourlyRate} onChange={e => setForm({ ...form, HourlyRate: e.target.value })} className={field} dir="ltr" /></div>
                            <div><label className={lbl}>{L('البريد', 'Work email')}</label><input value={form.WorkEmail} onChange={e => setForm({ ...form, WorkEmail: e.target.value })} className={field} dir="ltr" /></div>
                            <div><label className={lbl}>{L('الهاتف', 'Phone')}</label><input value={form.PhoneNumber} onChange={e => setForm({ ...form, PhoneNumber: e.target.value })} className={field} dir="ltr" /></div>
                            <div><label className={lbl}>{L('تاريخ التعيين', 'Start date')}</label><input type="date" value={form.StartDate} onChange={e => setForm({ ...form, StartDate: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('النوع', 'Gender')}</label><select value={form.Gender} onChange={e => setForm({ ...form, Gender: e.target.value })} className={field}><option value="male">{L('ذكر', 'Male')}</option><option value="female">{L('أنثى', 'Female')}</option></select></div>
                            <div><label className={lbl}>{L('رقم الحساب البنكي', 'Bank account')}</label><input value={form.BankAccountNumber} onChange={e => setForm({ ...form, BankAccountNumber: e.target.value })} className={field} dir="ltr" /></div>
                            <label className="flex items-center gap-2 text-silver text-sm cursor-pointer pt-5"><input type="checkbox" checked={form.IsActive} onChange={e => setForm({ ...form, IsActive: e.target.checked })} className="accent-[#DBA935]" />{L('موظف نشط', 'Active employee')}</label>
                            <div className="sm:col-span-2"><label className={lbl}>{L('خطة التطوير / ملاحظات', 'Development plan / notes')}</label><textarea value={form.DevelopmentPlan} onChange={e => setForm({ ...form, DevelopmentPlan: e.target.value })} rows={2} className={field} /></div>
                            <div className="sm:col-span-2 flex gap-3 pt-2">
                                <button onClick={save} disabled={saving || !form.Name.trim()} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold hover:bg-yellow-600 transition disabled:opacity-50">{saving ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ', 'Save')}</button>
                                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-silver/10 rounded-lg text-silver hover:bg-silver/20 transition">{L('إلغاء', 'Cancel')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {detail && (
                <DetailModal locale={locale} onClose={() => setDetail(null)}
                    title={detail.Name || detail.EmployeeID}
                    subtitle={`${detail.EmployeeID} — ${detail.Position || ''}`}
                    rows={[
                        { label: L('الكود', 'ID'), value: detail.EmployeeID },
                        { label: L('الحالة', 'Status'), value: detail.IsActive ? L('نشط', 'Active') : L('غير نشط', 'Inactive') },
                        { label: L('المنصب', 'Position'), value: detail.Position || '—' },
                        { label: L('القسم', 'Department'), value: detail.Department || '—' },
                        { label: L('الدرجة الوظيفية', 'Job grade'), value: detail.JobGrade || '—' },
                        { label: L('الرقم القومي', 'National ID'), value: detail.NationalID || '—' },
                        { label: L('الراتب الشهري', 'Monthly salary'), value: detail.MonthlySalary != null ? Number(detail.MonthlySalary).toLocaleString() : '—' },
                        { label: L('أجر الساعة', 'Hourly rate'), value: detail.HourlyRate != null ? Number(detail.HourlyRate).toLocaleString() : '—' },
                        { label: L('الهاتف', 'Phone'), value: detail.PhoneNumber || '—' },
                        { label: L('البريد', 'Email'), value: detail.WorkEmail || '—' },
                        { label: L('تاريخ التعيين', 'Start date'), value: detail.StartDate || '—' },
                        { label: L('النوع', 'Gender'), value: detail.Gender === 'female' ? L('أنثى', 'Female') : L('ذكر', 'Male') },
                        { label: L('الحساب البنكي', 'Bank account'), value: detail.BankAccountNumber || '—' },
                        { label: L('خطة التطوير / ملاحظات', 'Development plan / notes'), value: detail.DevelopmentPlan || '—', full: true },
                    ]}
                />
            )}
        </div>
    );
}
