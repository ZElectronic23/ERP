'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';
import DetailModal from '@/components/DetailModal';

type Target = 'client' | 'employee';

interface Criterion { key: string; ar: string; en: string; }

// Fixed criteria lists (no free typing)
const CRITERIA: Record<Target, Criterion[]> = {
    client: [
        { key: 'payment', ar: 'الالتزام بالسداد', en: 'Payment commitment' },
        { key: 'clarity', ar: 'وضوح المتطلبات', en: 'Requirements clarity' },
        { key: 'cooperation', ar: 'سهولة التعامل والتعاون', en: 'Ease of dealing' },
        { key: 'responsiveness', ar: 'سرعة الرد', en: 'Responsiveness' },
        { key: 'punctuality', ar: 'التزام المواعيد', en: 'Appointment commitment' },
        { key: 'loyalty', ar: 'تكرار التعامل والولاء', en: 'Repeat business & loyalty' },
    ],
    employee: [
        { key: 'work_quality', ar: 'جودة العمل', en: 'Work quality' },
        { key: 'punctuality', ar: 'الالتزام بالمواعيد', en: 'Punctuality' },
        { key: 'teamwork', ar: 'التعاون مع الفريق', en: 'Teamwork' },
        { key: 'initiative', ar: 'المبادرة والمسؤولية', en: 'Initiative & responsibility' },
        { key: 'technical', ar: 'المهارة الفنية', en: 'Technical skill' },
        { key: 'instructions', ar: 'الالتزام بالتعليمات', en: 'Following instructions' },
        { key: 'customer_service', ar: 'خدمة العملاء', en: 'Customer service' },
    ],
};

const RATING: Record<string, { ar: string; en: string; cls: string }> = {
    excellent: { ar: 'ممتاز', en: 'Excellent', cls: 'bg-green-500/20 text-green-400' },
    good: { ar: 'جيد', en: 'Good', cls: 'bg-blue-500/20 text-blue-400' },
    fair: { ar: 'مقبول', en: 'Fair', cls: 'bg-yellow-500/20 text-yellow-400' },
    weak: { ar: 'ضعيف', en: 'Weak', cls: 'bg-red-500/20 text-red-400' },
};
const ratingKey = (pct: number) => pct >= 85 ? 'excellent' : pct >= 70 ? 'good' : pct >= 50 ? 'fair' : 'weak';

export default function EvaluationsPage() {
    const router = useRouter();
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [target, setTarget] = useState<Target>('client');
    const [rows, setRows] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [emps, setEmps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCEO, setIsCEO] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<{ targetId: string; period: string; notes: string; scores: Record<string, number> }>({ targetId: '', period: '', notes: '', scores: {} });
    const [detail, setDetail] = useState<any | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('evaluations').select('*').eq('target_type', target).order('created_at', { ascending: false });
        q = showDeleted ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null);
        const [{ data: evs }, { data: cl }, { data: em }] = await Promise.all([
            q,
            supabase.from('clients').select('ClientId, ClientName').is('deleted_at', null),
            supabase.from('employees').select('id:EmployeeID, name:Name').is('deleted_at', null).order('Name'),
        ]);
        setRows(evs || []); setClients(cl || []); setEmps(em || []);
        setLoading(false);
    }, [target, showDeleted]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('users').select('role_key').eq('email', user.email).maybeSingle();
            setIsCEO((data?.role_key || '').toLowerCase() === 'ceo');
        })();
    }, []);

    const criteria = CRITERIA[target];
    const targetList = target === 'client' ? clients.map(c => ({ id: c.ClientId, name: c.ClientName })) : emps.map(e => ({ id: e.id, name: e.name }));

    // live overall from current form scores
    const overall = useMemo(() => {
        const vals = criteria.map(c => form.scores[c.key]).filter(v => v != null) as number[];
        if (vals.length === 0) return 0;
        return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) / 5 * 100);
    }, [form.scores, criteria]);

    const openNew = () => { setForm({ targetId: '', period: '', notes: '', scores: {} }); setShowModal(true); };

    const save = async () => {
        if (!form.targetId) return;
        setSaving(true);
        const name = targetList.find(t => t.id === form.targetId)?.name || '';
        const { data: { user } } = await supabase.auth.getUser();
        let evId = null, evName = '';
        if (user) { const { data: u } = await supabase.from('users').select('entity_id, full_name').eq('email', user.email).maybeSingle(); evId = u?.entity_id || null; evName = u?.full_name || user.email || ''; }
        const { error } = await supabase.from('evaluations').insert([{
            target_type: target, target_id: form.targetId, target_name: name, period: form.period || null,
            scores: form.scores, overall_score: overall, rating: ratingKey(overall), notes: form.notes || null,
            evaluator_id: evId, evaluator_name: evName, created_at: new Date().toISOString(),
        }]);
        setSaving(false);
        if (error) { alert(error.message); return; }
        setShowModal(false); load();
    };

    const softDelete = async (id: string) => {
        if (!confirm(L('نقل التقييم للمحذوفات؟', 'Move evaluation to trash?'))) return;
        await supabase.from('evaluations').update({ deleted_at: new Date().toISOString() }).eq('id', id); load();
    };
    const restore = async (id: string) => { await supabase.from('evaluations').update({ deleted_at: null }).eq('id', id); load(); };
    const hardDelete = async (id: string) => {
        if (!confirm(L('حذف نهائي لا يمكن التراجع عنه. متأكد؟', 'Permanent delete cannot be undone. Sure?'))) return;
        const { error } = await supabase.from('evaluations').delete().eq('id', id);
        if (!error) load(); else alert(error.message);
    };

    const field = 'w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white placeholder-silver/50 focus:outline-none focus:border-gold text-sm';
    const SCORE_LABELS = [L('ضعيف جداً', 'Very weak'), L('ضعيف', 'Weak'), L('متوسط', 'Average'), L('جيد', 'Good'), L('ممتاز', 'Excellent')];

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#DBA935]">{L('التقييمات', 'Evaluations')}</h1>
                        <p className="text-[#C0C0C0] text-sm mt-1">{L('تقييم بمعايير محددة (بدون كتابة حرة)', 'Evaluation by fixed criteria')}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowDeleted(v => !v)} className="px-4 py-2 rounded-xl bg-white/5 text-[#C0C0C0] border border-silver/20 hover:bg-white/10 transition text-sm">{showDeleted ? L('النشطة', 'Active') : L('المحذوفات', 'Trash')}</button>
                        {!showDeleted && <button onClick={openNew} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm">{L('+ تقييم جديد', '+ New Evaluation')}</button>}
                    </div>
                </div>

                <div className="flex gap-2 mb-4">
                    {(['client', 'employee'] as const).map(tt => (
                        <button key={tt} onClick={() => setTarget(tt)} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${target === tt ? 'bg-[#DBA935] text-[#3E3B3F]' : 'bg-white/5 text-[#C0C0C0] hover:bg-white/10'}`}>
                            {tt === 'client' ? L('العملاء', 'Clients') : L('الموظفون', 'Employees')}
                        </button>
                    ))}
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                    <table className="w-full text-sm" style={{ minWidth: '720px' }}>
                        <thead><tr className="bg-[#242428] text-[#DBA935]/90">
                            {[target === 'client' ? L('العميل', 'Client') : L('الموظف', 'Employee'), L('الفترة', 'Period'), L('الدرجة', 'Score'), L('التقدير', 'Rating'), L('المُقيِّم', 'Evaluator'), L('التاريخ', 'Date'), L('الإجراءات', 'Actions')].map((h, i) => <th key={i} className="py-2.5 px-3 text-start font-semibold border-b border-[#DBA935]/20 whitespace-nowrap">{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {loading ? <tr><td colSpan={7} className="text-center py-10 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</td></tr>
                                : rows.length === 0 ? <tr><td colSpan={7} className="text-center py-10 text-[#C0C0C0]">{L('لا توجد تقييمات', 'No evaluations')}</td></tr>
                                    : rows.map(r => {
                                        const rt = RATING[r.rating] || RATING.fair;
                                        return (
                                            <tr key={r.id} className="odd:bg-white/[0.02] border-b border-[#3E3B3F]/60 text-white">
                                                <td className="py-2.5 px-3">{r.target_name || '—'}</td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">{r.period || '—'}</td>
                                                <td className="py-2.5 px-3 whitespace-nowrap font-bold text-[#DBA935]">{Math.round(r.overall_score)}%</td>
                                                <td className="py-2.5 px-3 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full text-xs ${rt.cls}`}>{isAr ? rt.ar : rt.en}</span></td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">{r.evaluator_name || '—'}</td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-3">
                                                        {showDeleted ? (<>
                                                            <button onClick={() => restore(r.id)} className="text-green-400 hover:underline">{L('استعادة', 'Restore')}</button>
                                                            {isCEO && <button onClick={() => hardDelete(r.id)} className="text-red-700 hover:text-red-500 font-semibold">{L('حذف نهائي', 'Delete forever')}</button>}
                                                        </>) : (<>
                                                            <button onClick={() => setDetail(r)} className="text-[#C0C0C0] hover:text-white hover:underline">{L('تفاصيل', 'Details')}</button>
                                                            <button onClick={() => softDelete(r.id)} className="text-red-400 hover:underline">{L('حذف', 'Delete')}</button>
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
                    <div className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]">
                            <h2 className="text-lg font-alata text-gold">{target === 'client' ? L('تقييم عميل', 'Evaluate client') : L('تقييم موظف', 'Evaluate employee')}</h2>
                            <button onClick={() => setShowModal(false)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div><label className="block text-silver mb-1 text-xs">{target === 'client' ? L('العميل', 'Client') : L('الموظف', 'Employee')} *</label>
                                    <select value={form.targetId} onChange={e => setForm({ ...form, targetId: e.target.value })} className={field}>
                                        <option value="">{L('— اختر —', '— select —')}</option>
                                        {targetList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div><label className="block text-silver mb-1 text-xs">{L('الفترة (اختياري)', 'Period (optional)')}</label>
                                    <input value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} className={field} placeholder={L('مثال: الربع الثالث 2026', 'e.g. Q3 2026')} /></div>
                            </div>

                            <div className="space-y-2">
                                {criteria.map(c => (
                                    <div key={c.key} className="flex items-center justify-between gap-3 border-b border-silver/10 pb-2">
                                        <span className="text-white text-sm flex-1">{isAr ? c.ar : c.en}</span>
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map(n => (
                                                <button key={n} type="button" onClick={() => setForm({ ...form, scores: { ...form.scores, [c.key]: n } })}
                                                    title={SCORE_LABELS[n - 1]}
                                                    className={`w-7 h-7 rounded-lg text-xs font-bold transition ${(form.scores[c.key] || 0) >= n ? 'bg-[#DBA935] text-[#3E3B3F]' : 'bg-white/5 text-silver hover:bg-white/10'}`}>
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center justify-between bg-black/30 rounded-xl border border-gold/20 p-3">
                                <span className="text-silver text-sm">{L('الدرجة الكلية', 'Overall score')}</span>
                                <span className="flex items-center gap-2">
                                    <span className="text-2xl font-bold text-[#DBA935]">{overall}%</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${RATING[ratingKey(overall)].cls}`}>{isAr ? RATING[ratingKey(overall)].ar : RATING[ratingKey(overall)].en}</span>
                                </span>
                            </div>

                            <div><label className="block text-silver mb-1 text-xs">{L('ملاحظات (اختياري)', 'Notes (optional)')}</label>
                                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={field} /></div>

                            <div className="flex gap-3 pt-1">
                                <button onClick={save} disabled={saving || !form.targetId || Object.keys(form.scores).length === 0} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold hover:bg-yellow-600 transition disabled:opacity-50">{saving ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ التقييم', 'Save evaluation')}</button>
                                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-silver/10 rounded-lg text-silver hover:bg-silver/20 transition">{L('إلغاء', 'Cancel')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {detail && (
                <DetailModal locale={locale} onClose={() => setDetail(null)}
                    title={detail.target_name || '—'}
                    subtitle={`${detail.target_type === 'client' ? L('عميل', 'Client') : L('موظف', 'Employee')} · ${Math.round(detail.overall_score)}% · ${isAr ? (RATING[detail.rating]?.ar || '') : (RATING[detail.rating]?.en || '')}`}
                    rows={[
                        ...(CRITERIA[detail.target_type as Target] || []).map(c => ({
                            label: isAr ? c.ar : c.en,
                            value: <span className="text-[#DBA935] font-bold">{(detail.scores?.[c.key] ?? '—')}{detail.scores?.[c.key] != null ? ' / 5' : ''}</span>,
                        })),
                        { label: L('الفترة', 'Period'), value: detail.period || '—' },
                        { label: L('المُقيِّم', 'Evaluator'), value: detail.evaluator_name || '—' },
                        { label: L('ملاحظات', 'Notes'), value: detail.notes || '—', full: true },
                    ]}
                />
            )}
        </div>
    );
}
