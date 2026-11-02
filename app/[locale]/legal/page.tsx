'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';
import ApprovalPanel from '@/components/ApprovalPanel';

interface Contract {
    id: string;
    contract_number: string | null;
    title: string;
    contract_type: string;
    party_type: string | null;
    party_id: string | null;
    party_name: string | null;
    start_date: string | null;
    end_date: string | null;
    value: number | null;
    currency: string | null;
    status: string;
    auto_renew: boolean;
    renewal_reminder_date: string | null;
    obligations: string | null;
    terms: string | null;
    notes: string | null;
    file_link: string | null;
    linked_project_code: string | null;
    created_at: string;
    deleted_at: string | null;
}

const CONTRACT_TYPES: Record<string, { ar: string; en: string }> = {
    client_service: { ar: 'خدمة عميل', en: 'Client Service' },
    partnership: { ar: 'شراكة', en: 'Partnership' },
    employment: { ar: 'توظيف', en: 'Employment' },
    nda: { ar: 'سرية (NDA)', en: 'NDA' },
    vendor_supply: { ar: 'توريد مورد', en: 'Vendor Supply' },
    maintenance: { ar: 'صيانة', en: 'Maintenance' },
    other: { ar: 'أخرى', en: 'Other' },
};

const STATUS: Record<string, { ar: string; en: string; cls: string }> = {
    draft: { ar: 'مسودة', en: 'Draft', cls: 'bg-gray-500/20 text-gray-300' },
    active: { ar: 'ساري', en: 'Active', cls: 'bg-green-500/20 text-green-400' },
    expired: { ar: 'منتهي', en: 'Expired', cls: 'bg-orange-500/20 text-orange-400' },
    terminated: { ar: 'مفسوخ', en: 'Terminated', cls: 'bg-red-500/20 text-red-400' },
    renewed: { ar: 'مُجدَّد', en: 'Renewed', cls: 'bg-blue-500/20 text-blue-400' },
};

const PARTY_TYPES: Record<string, { ar: string; en: string }> = {
    client: { ar: 'عميل', en: 'Client' },
    partner: { ar: 'شريك', en: 'Partner' },
    employee: { ar: 'موظف', en: 'Employee' },
    vendor: { ar: 'مورد', en: 'Vendor' },
    external: { ar: 'طرف خارجي', en: 'External' },
};

const emptyForm = {
    id: '', title: '', contract_type: 'client_service', party_type: 'client',
    party_id: '', party_name: '', start_date: '', end_date: '', value: '',
    currency: 'EGP', status: 'draft', auto_renew: false, renewal_reminder_date: '',
    obligations: '', terms: '', notes: '', file_link: '', linked_project_code: '',
};

export default function LegalPage() {
    const router = useRouter();
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [contracts, setContracts] = useState<Contract[]>([]);
    const [parties, setParties] = useState<Record<string, { id: string; name: string }[]>>({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<typeof emptyForm>(emptyForm);
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [search, setSearch] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: cons }, cl, pa, em, ve] = await Promise.all([
            supabase.from('contracts').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
            supabase.from('clients').select('ClientId, ClientName').is('deleted_at', null),
            supabase.from('partners').select('PartnerID, PartnerName'),
            supabase.from('employees').select('EmployeeID, Name'),
            supabase.from('vendors').select('VendorID, VendorName').is('deleted_at', null),
        ]);
        setContracts((cons as Contract[]) || []);
        setParties({
            client: (cl.data || []).map((r: any) => ({ id: r.ClientId, name: r.ClientName })),
            partner: (pa.data || []).map((r: any) => ({ id: r.PartnerID, name: r.PartnerName })),
            employee: (em.data || []).map((r: any) => ({ id: r.EmployeeID, name: r.Name })),
            vendor: (ve.data || []).map((r: any) => ({ id: r.VendorID, name: r.VendorName })),
            external: [],
        });
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // ─── Expiry alerts: active contracts ending within 30 days ───
    const expiring = useMemo(() => {
        const now = Date.now();
        return contracts.filter(c => {
            if (!c.end_date || c.status === 'terminated' || c.status === 'expired') return false;
            const days = Math.floor((new Date(c.end_date).getTime() - now) / 86400000);
            return days <= 30 && days >= -3650;
        }).map(c => ({ ...c, days: Math.floor((new Date(c.end_date!).getTime() - now) / 86400000) }))
            .sort((a, b) => a.days - b.days);
    }, [contracts]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return contracts.filter(c =>
            (!filterType || c.contract_type === filterType) &&
            (!filterStatus || c.status === filterStatus) &&
            (!q || [c.title, c.contract_number, c.party_name].some(v => (v || '').toLowerCase().includes(q)))
        );
    }, [contracts, filterType, filterStatus, search]);

    const nextNumber = async (): Promise<string> => {
        const { data } = await supabase.from('contracts').select('contract_number')
            .ilike('contract_number', 'ZE-CON-%').order('contract_number', { ascending: false }).limit(1);
        let n = 1;
        if (data && data.length) {
            const m = String(data[0].contract_number).match(/ZE-CON-(\d+)/);
            if (m) n = parseInt(m[1]) + 1;
        }
        return `ZE-CON-${n.toString().padStart(4, '0')}`;
    };

    const openNew = () => { setForm(emptyForm); setShowModal(true); };
    const openEdit = (c: Contract) => {
        setForm({
            id: c.id, title: c.title, contract_type: c.contract_type, party_type: c.party_type || 'client',
            party_id: c.party_id || '', party_name: c.party_name || '',
            start_date: c.start_date || '', end_date: c.end_date || '',
            value: c.value != null ? String(c.value) : '', currency: c.currency || 'EGP',
            status: c.status, auto_renew: c.auto_renew, renewal_reminder_date: c.renewal_reminder_date || '',
            obligations: c.obligations || '', terms: c.terms || '', notes: c.notes || '',
            file_link: c.file_link || '', linked_project_code: c.linked_project_code || '',
        });
        setShowModal(true);
    };

    const save = async () => {
        if (!form.title.trim()) return;
        setSaving(true);
        const payload: any = {
            title: form.title.trim(),
            contract_type: form.contract_type,
            party_type: form.party_type,
            party_id: form.party_id || null,
            party_name: form.party_name || (parties[form.party_type]?.find(p => p.id === form.party_id)?.name) || null,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
            value: form.value ? parseFloat(form.value) : 0,
            currency: form.currency || 'EGP',
            status: form.status,
            auto_renew: form.auto_renew,
            renewal_reminder_date: form.renewal_reminder_date || null,
            obligations: form.obligations || null,
            terms: form.terms || null,
            notes: form.notes || null,
            file_link: form.file_link || null,
            linked_project_code: form.linked_project_code || null,
            updated_at: new Date().toISOString(),
        };

        let error;
        if (form.id) {
            ({ error } = await supabase.from('contracts').update(payload).eq('id', form.id));
        } else {
            payload.contract_number = await nextNumber();
            payload.created_at = new Date().toISOString();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: u } = await supabase.from('users').select('entity_id').eq('email', user.email).single();
                payload.created_by = u?.entity_id || null;
            }
            ({ error } = await supabase.from('contracts').insert([payload]));
        }
        setSaving(false);
        if (!error) { setShowModal(false); setForm(emptyForm); load(); }
        else alert(error.message);
    };

    const softDelete = async (id: string) => {
        if (!confirm(L('نقل العقد للمحذوفات؟', 'Move contract to trash?'))) return;
        const { error } = await supabase.from('contracts').update({ deleted_at: new Date().toISOString() }).eq('id', id);
        if (!error) load();
    };

    const field = 'w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white placeholder-silver/50 focus:outline-none focus:border-gold transition-all text-sm';
    const lbl = 'block text-silver mb-1 text-xs';
    const fmt = (n: number | null) => n ? Number(n).toLocaleString() : '—';

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#DBA935]">{L('الإدارة القانونية — العقود', 'Legal — Contracts')}</h1>
                        <p className="text-[#C0C0C0] text-sm mt-1">{L(`إجمالي ${contracts.length} عقد`, `${contracts.length} contracts`)}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => router.push(`/${locale}/legal/deleted`)} className="px-4 py-2 rounded-xl bg-white/5 text-[#C0C0C0] border border-silver/20 hover:bg-white/10 transition text-sm">
                            {L('المحذوفات', 'Trash')}
                        </button>
                        <button onClick={openNew} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm">
                            {L('+ عقد جديد', '+ New Contract')}
                        </button>
                    </div>
                </div>

                {/* ── Expiry alerts ── */}
                {expiring.length > 0 && (
                    <div className="mb-4 bg-orange-500/10 border border-orange-500/40 rounded-xl p-3">
                        <p className="text-orange-300 text-sm font-semibold mb-2">
                            ⚠ {L(`${expiring.length} عقد قارب على الانتهاء أو منتهٍ`, `${expiring.length} contract(s) expiring soon or overdue`)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {expiring.slice(0, 8).map(c => (
                                <button key={c.id} onClick={() => openEdit(c)}
                                    className="text-xs px-2 py-1 rounded-lg bg-black/30 text-orange-200 border border-orange-500/30 hover:border-orange-400">
                                    {c.title} — {c.days < 0 ? L(`منذ ${-c.days} يوم`, `${-c.days}d overdue`) : L(`باقي ${c.days} يوم`, `${c.days}d left`)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Filters ── */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={L('بحث...', 'Search...')}
                        className="flex-1 min-w-[160px] px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white placeholder-silver/50 focus:outline-none focus:border-gold text-sm" />
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white text-sm">
                        <option value="">{L('كل الأنواع', 'All types')}</option>
                        {Object.entries(CONTRACT_TYPES).map(([k, v]) => <option key={k} value={k}>{isAr ? v.ar : v.en}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white text-sm">
                        <option value="">{L('كل الحالات', 'All statuses')}</option>
                        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{isAr ? v.ar : v.en}</option>)}
                    </select>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                    <table className="w-full text-sm" style={{ minWidth: '880px' }}>
                        <thead>
                            <tr className="bg-[#242428] text-[#DBA935]/90">
                                {[L('الرقم', 'No.'), L('العنوان', 'Title'), L('النوع', 'Type'), L('الطرف', 'Party'), L('من', 'From'), L('إلى', 'To'), L('القيمة', 'Value'), L('الحالة', 'Status'), L('الإجراءات', 'Actions')].map((h, i) => (
                                    <th key={i} className="py-2.5 px-3 text-start font-semibold whitespace-nowrap border-b border-[#DBA935]/20">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9} className="text-center py-10 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={9} className="text-center py-10 text-[#C0C0C0]">{L('لا توجد عقود', 'No contracts')}</td></tr>
                            ) : filtered.map(c => {
                                const st = STATUS[c.status] || STATUS.draft;
                                const ct = CONTRACT_TYPES[c.contract_type] || CONTRACT_TYPES.other;
                                return (
                                    <tr key={c.id} className="odd:bg-white/[0.02] hover:bg-[#DBA935]/10 transition border-b border-[#3E3B3F]/60 text-white cursor-pointer" onClick={() => openEdit(c)}>
                                        <td className="py-2.5 px-3 whitespace-nowrap text-[#DBA935] font-medium">{c.contract_number || '—'}</td>
                                        <td className="py-2.5 px-3">{c.title}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">{isAr ? ct.ar : ct.en}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">{c.party_name || '—'}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">{c.start_date || '—'}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">{c.end_date || '—'}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">{fmt(c.value)} {c.value ? (c.currency || 'EGP') : ''}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full text-xs ${st.cls}`}>{isAr ? st.ar : st.en}</span></td>
                                        <td className="py-2.5 px-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                            <span className="inline-flex items-center gap-3">
                                                <button onClick={() => openEdit(c)} className="text-[#DBA935] hover:underline">{L('فتح', 'Open')}</button>
                                                <button onClick={() => softDelete(c.id)} className="text-red-400 hover:underline">{L('حذف', 'Delete')}</button>
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Create / Edit modal ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowModal(false)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]">
                            <h2 className="text-lg font-alata text-gold">{form.id ? L('تعديل العقد', 'Edit Contract') : L('عقد جديد', 'New Contract')}</h2>
                            <button onClick={() => setShowModal(false)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className={lbl}>{L('عنوان العقد', 'Contract title')} *</label>
                                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={field} placeholder={L('مثال: عقد صيانة أنظمة كاميرات', 'e.g. CCTV maintenance agreement')} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={lbl}>{L('نوع العقد', 'Contract type')}</label>
                                    <select value={form.contract_type} onChange={e => setForm({ ...form, contract_type: e.target.value })} className={field}>
                                        {Object.entries(CONTRACT_TYPES).map(([k, v]) => <option key={k} value={k}>{isAr ? v.ar : v.en}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={lbl}>{L('الحالة', 'Status')}</label>
                                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={field}>
                                        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{isAr ? v.ar : v.en}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={lbl}>{L('نوع الطرف', 'Party type')}</label>
                                    <select value={form.party_type} onChange={e => setForm({ ...form, party_type: e.target.value, party_id: '', party_name: '' })} className={field}>
                                        {Object.entries(PARTY_TYPES).map(([k, v]) => <option key={k} value={k}>{isAr ? v.ar : v.en}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={lbl}>{L('الطرف', 'Party')}</label>
                                    {form.party_type === 'external' ? (
                                        <input value={form.party_name} onChange={e => setForm({ ...form, party_name: e.target.value })} className={field} placeholder={L('اسم الطرف الخارجي', 'External party name')} />
                                    ) : (
                                        <select value={form.party_id} onChange={e => setForm({ ...form, party_id: e.target.value, party_name: parties[form.party_type]?.find(p => p.id === e.target.value)?.name || '' })} className={field}>
                                            <option value="">{L('— اختر —', '— select —')}</option>
                                            {(parties[form.party_type] || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className={lbl}>{L('تاريخ البدء', 'Start date')}</label>
                                    <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className={field} />
                                </div>
                                <div>
                                    <label className={lbl}>{L('تاريخ الانتهاء', 'End date')}</label>
                                    <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className={field} />
                                </div>
                                <div>
                                    <label className={lbl}>{L('تذكير التجديد', 'Renewal reminder')}</label>
                                    <input type="date" value={form.renewal_reminder_date} onChange={e => setForm({ ...form, renewal_reminder_date: e.target.value })} className={field} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                                <div>
                                    <label className={lbl}>{L('قيمة العقد', 'Contract value')}</label>
                                    <input type="number" min="0" step="0.01" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className={field} dir="ltr" />
                                </div>
                                <div>
                                    <label className={lbl}>{L('العملة', 'Currency')}</label>
                                    <input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className={field} />
                                </div>
                                <label className="flex items-center gap-2 text-silver text-sm cursor-pointer pb-2">
                                    <input type="checkbox" checked={form.auto_renew} onChange={e => setForm({ ...form, auto_renew: e.target.checked })} className="accent-[#DBA935]" />
                                    {L('تجديد تلقائي', 'Auto-renew')}
                                </label>
                            </div>
                            <div>
                                <label className={lbl}>{L('الالتزامات', 'Obligations')}</label>
                                <textarea value={form.obligations} onChange={e => setForm({ ...form, obligations: e.target.value })} rows={2} className={field} placeholder={L('التزامات كل طرف...', 'Obligations of each party...')} />
                            </div>
                            <div>
                                <label className={lbl}>{L('الشروط والأحكام', 'Terms & conditions')}</label>
                                <textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} rows={2} className={field} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={lbl}>{L('رابط ملف العقد', 'Contract file link')}</label>
                                    <input value={form.file_link} onChange={e => setForm({ ...form, file_link: e.target.value })} className={field} placeholder="https://drive.google.com/..." dir="ltr" />
                                </div>
                                <div>
                                    <label className={lbl}>{L('كود المشروع المرتبط', 'Linked project code')}</label>
                                    <input value={form.linked_project_code} onChange={e => setForm({ ...form, linked_project_code: e.target.value })} className={field} placeholder="PRJ-001" dir="ltr" />
                                </div>
                            </div>
                            <div>
                                <label className={lbl}>{L('ملاحظات', 'Notes')}</label>
                                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={field} />
                            </div>
                            {form.id && (
                                <ApprovalPanel entityType="contract" entityId={form.id} locale={locale} />
                            )}
                            <div className="flex gap-3 pt-2">
                                <button onClick={save} disabled={saving || !form.title.trim()} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold hover:bg-yellow-600 transition disabled:opacity-50">
                                    {saving ? L('جارٍ الحفظ...', 'Saving...') : form.id ? L('حفظ التعديلات', 'Save changes') : L('إنشاء العقد', 'Create contract')}
                                </button>
                                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-silver/10 rounded-lg text-silver hover:bg-silver/20 transition">{L('إلغاء', 'Cancel')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
