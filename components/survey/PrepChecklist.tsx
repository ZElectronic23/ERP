'use client';

import { useState, useEffect, useCallback } from 'react';
import { STATUS_LABEL, KIND_LABEL, ITEM_STATUSES, type ReadinessLevel } from '@/lib/survey/checklist';

interface Item {
    id: string; item_key: string | null; kind: string; label_ar: string; label_en: string | null;
    detail: string | null; critical: boolean; remote_possible: boolean; status: string; note: string | null; source: string;
}
interface Readiness { level: ReadinessLevel; criticalTotal: number; missingCritical: number; blockers: { ar: string; en: string }[]; }

const READINESS: Record<ReadinessLevel, { ar: string; en: string; cls: string }> = {
    go: { ar: 'يمكن المضي في الزيارة — المتطلبات الحرجة جاهزة', en: 'Ready to proceed — critical items are set', cls: 'bg-green-500/15 border-green-500/40 text-green-300' },
    prepare: { ar: 'جهّز العناصر الحرجة الناقصة قبل الذهاب', en: 'Prepare the missing critical items before going', cls: 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300' },
    await_approval: { ar: 'بانتظار اعتماد/تفويض مطلوب قبل الزيارة', en: 'Awaiting a required approval before the visit', cls: 'bg-orange-500/15 border-orange-500/40 text-orange-300' },
    decision: { ar: 'عنصر حرج غير متاح — يلزم قرار إدارة أو إعادة جدولة', en: 'A critical item is unavailable — management decision or reschedule', cls: 'bg-red-500/15 border-red-500/40 text-red-300' },
    empty: { ar: 'لم تُولَّد قائمة التجهيز بعد', en: 'Checklist not generated yet', cls: 'bg-white/5 border-white/10 text-[#C0C0C0]' },
};

export default function PrepChecklist({ surveyId, locale = 'ar' }: { surveyId: string; locale?: string }) {
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);
    const [items, setItems] = useState<Item[]>([]);
    const [readiness, setReadiness] = useState<Readiness>({ level: 'empty', criticalTotal: 0, missingCritical: 0, blockers: [] });
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [open, setOpen] = useState(false);
    const [newLabel, setNewLabel] = useState('');

    const field = 'bg-black/30 border border-[#DBA935]/20 rounded-lg px-2 py-1 text-xs text-white focus:border-[#DBA935]/60 outline-none';

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/surveys/${surveyId}/checklist`);
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            setItems(j.items || []); setReadiness(j.readiness);
        } catch (e: any) { setErr(e.message); }
        setLoading(false);
    }, [surveyId]);

    useEffect(() => { refresh(); }, [refresh]);

    const post = async (body: any) => {
        setBusy(true); setErr('');
        try {
            const res = await fetch(`/api/surveys/${surveyId}/checklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            setItems(j.items || []); setReadiness(j.readiness);
            return j;
        } catch (e: any) { setErr(e.message); }
        finally { setBusy(false); }
    };

    const r = READINESS[readiness.level];
    // group by kind
    const groups = items.reduce((m: Record<string, Item[]>, it) => { (m[it.kind] ||= []).push(it); return m; }, {});

    return (
        <div className="bg-black/40 backdrop-blur-sm p-4 md:p-5 rounded-3xl border border-[#DBA935]/20">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                <div>
                    <h2 className="text-[#DBA935] font-bold">{L('قائمة التجهيز قبل الزيارة', 'Pre-visit preparation')}</h2>
                    <p className="text-[#C0C0C0] text-xs">{L('تُولَّد تلقائياً من نوع العمل والأجهزة والتشخيص — عناصر قابلة للتطبيق فقط.', 'Auto-generated from work type, assets and diagnostics — applicable items only.')}</p>
                </div>
                <button onClick={() => post({ action: 'generate' })} disabled={busy} className="px-3 py-1.5 rounded-lg bg-[#DBA935]/20 text-[#DBA935] text-xs font-bold hover:bg-[#DBA935]/30 disabled:opacity-50">
                    {busy ? L('...', '...') : items.length ? L('↻ تحديث القائمة', '↻ Refresh list') : L('⚙ توليد القائمة', '⚙ Generate list')}
                </button>
            </div>

            <p className="text-[11px] text-[#C0C0C0]/60 mb-2">{L('القائمة تُبنى من آخر نسخة محفوظة — احفظ المسح قبل التوليد.', 'The list is built from the last saved version — save the survey before generating.')}</p>
            {err && <div className="mb-2 text-red-400 text-sm">{err}</div>}

            {/* readiness recommendation */}
            <div className={`rounded-xl border px-3 py-2 mb-3 text-sm ${r.cls}`}>
                <div className="font-bold">{isAr ? r.ar : r.en}</div>
                {readiness.criticalTotal > 0 && <div className="text-xs mt-0.5 opacity-90">{L(`عناصر حرجة ناقصة: ${readiness.missingCritical} من ${readiness.criticalTotal}`, `Missing critical: ${readiness.missingCritical} of ${readiness.criticalTotal}`)}</div>}
            </div>

            {loading ? <div className="text-center py-6 text-[#C0C0C0] text-sm">{L('جارٍ التحميل...', 'Loading...')}</div>
                : items.length === 0 ? <p className="text-[#C0C0C0]/60 text-sm py-2">{L('اضغط «توليد القائمة» بعد اختيار نوع العمل والأجهزة.', 'Click "Generate" after choosing the work type and assets.')}</p>
                    : (
                        <div className="space-y-3">
                            {Object.entries(groups).map(([kind, list]) => (
                                <div key={kind}>
                                    <h3 className="text-[#C0C0C0] text-xs font-bold mb-1">{isAr ? KIND_LABEL[kind]?.ar : KIND_LABEL[kind]?.en}</h3>
                                    <div className="space-y-1.5">
                                        {list.map(it => (
                                            <div key={it.id} className="flex flex-wrap items-center gap-2 bg-black/20 rounded-lg p-2">
                                                <span className="flex-1 min-w-[160px] text-sm text-white">
                                                    {it.critical && <span className="text-red-400" title={L('حرِج', 'critical')}>★ </span>}
                                                    {isAr ? it.label_ar : (it.label_en || it.label_ar)}
                                                    {it.remote_possible && <span className="ms-2 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300">{L('يمكن عن بُعد', 'remote OK')}</span>}
                                                    {it.detail && <span className="block text-[11px] text-[#C0C0C0]/70">{it.detail}</span>}
                                                </span>
                                                <select value={it.status} onChange={e => post({ action: 'update', itemId: it.id, status: e.target.value })} className={field}>
                                                    {ITEM_STATUSES.map(s => <option key={s} value={s}>{isAr ? STATUS_LABEL[s].ar : STATUS_LABEL[s].en}</option>)}
                                                </select>
                                                <button onClick={() => post({ action: 'delete', itemId: it.id })} className="text-red-400 text-xs hover:text-red-300">{L('حذف', 'Remove')}</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

            {/* add manual item */}
            <div className="mt-3 flex items-center gap-2">
                <button onClick={() => setOpen(o => !o)} className="text-xs text-[#DBA935] hover:underline">{open ? L('— إلغاء', '— cancel') : L('+ إضافة عنصر يدوي', '+ Add manual item')}</button>
                {open && (
                    <div className="flex items-center gap-2 flex-1">
                        <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder={L('وصف العنصر', 'Item description')} className={`${field} flex-1`} />
                        <button onClick={async () => { if (newLabel.trim()) { await post({ action: 'add', item: { label_ar: newLabel.trim(), label_en: newLabel.trim() } }); setNewLabel(''); setOpen(false); } }} className="px-3 py-1 rounded-lg bg-[#DBA935] text-[#3E3B3F] text-xs font-bold">{L('إضافة', 'Add')}</button>
                    </div>
                )}
            </div>
        </div>
    );
}
