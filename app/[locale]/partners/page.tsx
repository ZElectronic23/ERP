'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';

interface Partner {
    PartnerID: string;
    PartnerName: string | null;
    CompanyName: string | null;
    Role: string | null;
    Type: string | null;
    SharePercentage: string | null;
    DefaultRevenueShare: string | null;
    PartnerEmail: string | null;
    IsFinancialPartner: boolean | null;
    IsTechnicalPartner: boolean | null;
    JoinDate: string | null;
    IsActive: boolean | null;
    Notes: string | null;
    deleted_at: string | null;
}

const emptyForm = {
    PartnerID: '', PartnerName: '', CompanyName: '', Role: '', Type: '', SharePercentage: '',
    DefaultRevenueShare: '', PartnerEmail: '', IsFinancialPartner: false, IsTechnicalPartner: false,
    JoinDate: '', IsActive: true, Notes: '',
};

export default function PartnersPage() {
    const router = useRouter();
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [rows, setRows] = useState<Partner[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<typeof emptyForm>(emptyForm);
    const [search, setSearch] = useState('');
    const [isCEO, setIsCEO] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('partners').select('*').order('created_at', { ascending: false });
        q = showDeleted ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null);
        const { data } = await q;
        setRows((data as Partner[]) || []);
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
        return rows.filter(r => [r.PartnerName, r.CompanyName, r.Role, r.PartnerEmail].some(v => (v || '').toLowerCase().includes(s)));
    }, [rows, search]);

    const nextId = async (): Promise<string> => {
        const { data } = await supabase.from('partners').select('PartnerID').ilike('PartnerID', 'PTR-%').order('PartnerID', { ascending: false }).limit(1);
        let n = 1;
        if (data && data.length) { const m = String(data[0].PartnerID).match(/PTR-(\d+)/); if (m) n = parseInt(m[1]) + 1; }
        return `PTR-${n.toString().padStart(3, '0')}`;
    };

    const openNew = () => { setForm(emptyForm); setShowModal(true); };
    const openEdit = (r: Partner) => {
        setForm({
            PartnerID: r.PartnerID, PartnerName: r.PartnerName || '', CompanyName: r.CompanyName || '', Role: r.Role || '',
            Type: r.Type || '', SharePercentage: r.SharePercentage || '', DefaultRevenueShare: r.DefaultRevenueShare || '',
            PartnerEmail: r.PartnerEmail || '', IsFinancialPartner: r.IsFinancialPartner ?? false, IsTechnicalPartner: r.IsTechnicalPartner ?? false,
            JoinDate: r.JoinDate || '', IsActive: r.IsActive ?? true, Notes: r.Notes || '',
        });
        setShowModal(true);
    };

    const save = async () => {
        if (!form.PartnerName.trim()) return;
        setSaving(true);
        const payload: any = {
            PartnerName: form.PartnerName.trim(), CompanyName: form.CompanyName || null, Role: form.Role || null,
            Type: form.Type || null, SharePercentage: form.SharePercentage || null, DefaultRevenueShare: form.DefaultRevenueShare || null,
            PartnerEmail: form.PartnerEmail || null, IsFinancialPartner: form.IsFinancialPartner, IsTechnicalPartner: form.IsTechnicalPartner,
            JoinDate: form.JoinDate || null, IsActive: form.IsActive, Notes: form.Notes || null, updated_at: new Date().toISOString(),
        };
        let error;
        if (form.PartnerID && rows.some(r => r.PartnerID === form.PartnerID)) {
            ({ error } = await supabase.from('partners').update(payload).eq('PartnerID', form.PartnerID));
        } else {
            payload.PartnerID = await nextId();
            payload.created_at = new Date().toISOString();
            ({ error } = await supabase.from('partners').insert([payload]));
        }
        setSaving(false);
        if (!error) { setShowModal(false); setForm(emptyForm); load(); } else alert(error.message);
    };

    const softDelete = async (id: string) => {
        if (!confirm(L('نقل الشريك للمحذوفات؟', 'Move partner to trash?'))) return;
        const { error } = await supabase.from('partners').update({ deleted_at: new Date().toISOString() }).eq('PartnerID', id);
        if (!error) load();
    };
    const restore = async (id: string) => { await supabase.from('partners').update({ deleted_at: null }).eq('PartnerID', id); load(); };
    const hardDelete = async (id: string) => {
        if (!confirm(L('حذف نهائي لا يمكن التراجع عنه. متأكد؟', 'Permanent delete cannot be undone. Sure?'))) return;
        const { error } = await supabase.from('partners').delete().eq('PartnerID', id);
        if (!error) load(); else alert(error.message);
    };

    const field = 'w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white placeholder-silver/50 focus:outline-none focus:border-gold transition-all text-sm';
    const lbl = 'block text-silver mb-1 text-xs';

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#DBA935]">{L('الشركاء', 'Partners')}</h1>
                        <p className="text-[#C0C0C0] text-sm mt-1">{L(`إجمالي ${rows.length}`, `${rows.length} total`)}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowDeleted(v => !v)} className="px-4 py-2 rounded-xl bg-white/5 text-[#C0C0C0] border border-silver/20 hover:bg-white/10 transition text-sm">
                            {showDeleted ? L('النشطون', 'Active') : L('المحذوفات', 'Trash')}
                        </button>
                        {!showDeleted && <button onClick={openNew} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm">{L('+ شريك جديد', '+ New Partner')}</button>}
                    </div>
                </div>

                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={L('بحث...', 'Search...')}
                    className="w-full mb-4 px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white placeholder-silver/50 focus:outline-none focus:border-gold text-sm" />

                <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                    <table className="w-full text-sm" style={{ minWidth: '820px' }}>
                        <thead>
                            <tr className="bg-[#242428] text-[#DBA935]/90">
                                {[L('الكود', 'ID'), L('الاسم', 'Name'), L('الشركة', 'Company'), L('الدور', 'Role'), L('النسبة', 'Share %'), L('النوع', 'Type'), L('الحالة', 'Status'), L('الإجراءات', 'Actions')].map((h, i) => (
                                    <th key={i} className="py-2.5 px-3 text-start font-semibold whitespace-nowrap border-b border-[#DBA935]/20">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan={8} className="text-center py-10 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</td></tr>
                                : filtered.length === 0 ? <tr><td colSpan={8} className="text-center py-10 text-[#C0C0C0]">{L('لا يوجد شركاء', 'No partners')}</td></tr>
                                    : filtered.map(r => {
                                        const types = [r.IsFinancialPartner && L('مالي', 'Financial'), r.IsTechnicalPartner && L('فني', 'Technical')].filter(Boolean).join(' / ') || (r.Type || '—');
                                        return (
                                            <tr key={r.PartnerID} className="odd:bg-white/[0.02] hover:bg-[#DBA935]/10 transition border-b border-[#3E3B3F]/60 text-white">
                                                <td className="py-2.5 px-3 whitespace-nowrap text-[#DBA935] font-medium">{r.PartnerID}</td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    {showDeleted ? (r.PartnerName || '—') : <button onClick={() => router.push(`/${locale}/partners/${r.PartnerID}`)} className="text-white hover:text-[#DBA935] hover:underline">{r.PartnerName || '—'}</button>}
                                                </td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">{r.CompanyName || '—'}</td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">{r.Role || '—'}</td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">{r.SharePercentage || '—'}</td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">{types}</td>
                                                <td className="py-2.5 px-3 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full text-xs ${r.IsActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-300'}`}>{r.IsActive ? L('نشط', 'Active') : L('غير نشط', 'Inactive')}</span></td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-3">
                                                        {showDeleted ? (<>
                                                            <button onClick={() => restore(r.PartnerID)} className="text-green-400 hover:underline">{L('استعادة', 'Restore')}</button>
                                                            {isCEO && <button onClick={() => hardDelete(r.PartnerID)} className="text-red-700 hover:text-red-500 font-semibold">{L('حذف نهائي', 'Delete forever')}</button>}
                                                        </>) : (<>
                                                            <button onClick={() => openEdit(r)} className="text-[#DBA935] hover:underline">{L('تعديل', 'Edit')}</button>
                                                            <button onClick={() => softDelete(r.PartnerID)} className="text-red-400 hover:underline">{L('حذف', 'Delete')}</button>
                                                        </>)}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowModal(false)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]">
                            <h2 className="text-lg font-alata text-gold">{form.PartnerID ? L('تعديل شريك', 'Edit Partner') : L('شريك جديد', 'New Partner')}</h2>
                            <button onClick={() => setShowModal(false)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div><label className={lbl}>{L('الاسم', 'Name')} *</label><input value={form.PartnerName} onChange={e => setForm({ ...form, PartnerName: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('الشركة', 'Company')}</label><input value={form.CompanyName} onChange={e => setForm({ ...form, CompanyName: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('الدور', 'Role')}</label><input value={form.Role} onChange={e => setForm({ ...form, Role: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('النوع', 'Type')}</label><input value={form.Type} onChange={e => setForm({ ...form, Type: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('نسبة الشراكة %', 'Share %')}</label><input value={form.SharePercentage} onChange={e => setForm({ ...form, SharePercentage: e.target.value })} className={field} dir="ltr" /></div>
                            <div><label className={lbl}>{L('نصيب الإيراد الافتراضي', 'Default revenue share')}</label><input value={form.DefaultRevenueShare} onChange={e => setForm({ ...form, DefaultRevenueShare: e.target.value })} className={field} dir="ltr" /></div>
                            <div><label className={lbl}>{L('البريد', 'Email')}</label><input value={form.PartnerEmail} onChange={e => setForm({ ...form, PartnerEmail: e.target.value })} className={field} dir="ltr" /></div>
                            <div><label className={lbl}>{L('تاريخ الانضمام', 'Join date')}</label><input type="date" value={form.JoinDate} onChange={e => setForm({ ...form, JoinDate: e.target.value })} className={field} /></div>
                            <label className="flex items-center gap-2 text-silver text-sm cursor-pointer"><input type="checkbox" checked={form.IsFinancialPartner} onChange={e => setForm({ ...form, IsFinancialPartner: e.target.checked })} className="accent-[#DBA935]" />{L('شريك مالي', 'Financial partner')}</label>
                            <label className="flex items-center gap-2 text-silver text-sm cursor-pointer"><input type="checkbox" checked={form.IsTechnicalPartner} onChange={e => setForm({ ...form, IsTechnicalPartner: e.target.checked })} className="accent-[#DBA935]" />{L('شريك فني', 'Technical partner')}</label>
                            <label className="flex items-center gap-2 text-silver text-sm cursor-pointer"><input type="checkbox" checked={form.IsActive} onChange={e => setForm({ ...form, IsActive: e.target.checked })} className="accent-[#DBA935]" />{L('نشط', 'Active')}</label>
                            <div className="sm:col-span-2"><label className={lbl}>{L('ملاحظات', 'Notes')}</label><textarea value={form.Notes} onChange={e => setForm({ ...form, Notes: e.target.value })} rows={2} className={field} /></div>
                            <div className="sm:col-span-2 flex gap-3 pt-2">
                                <button onClick={save} disabled={saving || !form.PartnerName.trim()} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold hover:bg-yellow-600 transition disabled:opacity-50">{saving ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ', 'Save')}</button>
                                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-silver/10 rounded-lg text-silver hover:bg-silver/20 transition">{L('إلغاء', 'Cancel')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
