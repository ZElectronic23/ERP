'use client';

// Phase 3 UI: the project's business journey (Lead → … → Evaluation) shown as a horizontal
// strip. The effective stage is derived from REAL records server-side (GET the journey API);
// completed stages read gold, the current one is highlighted, and future ones are dimmed.
// "Sync from records" recomputes the stored stage; a gated stage can only be advanced into
// once the project's approval cycle is approved (the server enforces this — we just disable it).
import { useCallback, useEffect, useState } from 'react';

interface Stage { key: string; order: number; ar: string; en: string; gate?: boolean; }
interface JourneyResp {
    stages: Stage[]; derived: string; stored: string | null; effective: string;
    next: Stage[]; internalApproved: boolean;
    log: { from_stage: string | null; to_stage: string; actor: string | null; note: string | null; created_at: string }[];
}

export default function JourneyStrip({ code, locale }: { code: string; locale: string }) {
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);
    const [data, setData] = useState<JourneyResp | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [showLog, setShowLog] = useState(false);

    const load = useCallback(async () => {
        setLoading(true); setErr('');
        try {
            const res = await fetch(`/api/projects/${encodeURIComponent(code)}/journey`);
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            setData(j);
        } catch (e: any) { setErr(e.message); }
        setLoading(false);
    }, [code]);
    useEffect(() => { load(); }, [load]);

    const act = async (body: any) => {
        setBusy(true); setErr('');
        try {
            const res = await fetch(`/api/projects/${encodeURIComponent(code)}/journey`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            await load();
        } catch (e: any) { setErr(e.message); }
        setBusy(false);
    };

    if (loading) return <div className="mb-4 text-xs text-silver/50">{L('جارٍ تحميل رحلة المشروع…', 'Loading journey…')}</div>;
    if (!data) return err ? <div className="mb-4 text-xs text-red-400">{err}</div> : null;

    const effStage = data.stages.find(s => s.key === data.effective);
    const effOrder = effStage?.order ?? 0;
    const nextKeys = new Set(data.next.map(s => s.key));
    const total = data.stages.length;

    return (
        <div className="mb-5 bg-black/30 rounded-2xl border border-gold/20 p-3 print:hidden">
            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <h3 className="text-gold text-sm font-semibold">{L('رحلة المشروع', 'Project journey')}</h3>
                <div className="flex items-center gap-2">
                    <button onClick={() => act({ action: 'sync' })} disabled={busy}
                        className="px-2.5 py-1 rounded-lg bg-gold/15 text-gold text-xs hover:bg-gold/30 disabled:opacity-50">
                        ⟳ {L('مزامنة من السجلات', 'Sync from records')}
                    </button>
                    <button onClick={() => setShowLog(s => !s)}
                        className="px-2.5 py-1 rounded-lg bg-silver/10 text-silver text-xs hover:bg-silver/20">
                        {L('السجل', 'Log')} ({data.log.length})
                    </button>
                </div>
            </div>

            <p className="text-silver/50 text-[11px] mb-2">
                {L('المرحلة تُحدَّد تلقائياً من سجلات المشروع الفعلية (العميل، المسح، العروض، الاعتماد، الدفعات، التنفيذ، الفواتير، التسليم…)، فتبدأ من حيث وصل المشروع فعلاً. 🔒 = مرحلة تحتاج اعتماداً داخلياً.',
                   'The stage is derived automatically from the project\'s real records (client, survey, offers, approval, payments, execution, invoices, handover…), so it starts wherever the project actually is. 🔒 = stage needing internal approval.')}
            </p>

            <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs text-silver">{L('المرحلة الحالية', 'Current stage')}:</span>
                <span className="px-2.5 py-1 rounded-lg bg-gold text-darkwhite text-xs font-bold">{isAr ? effStage?.ar : effStage?.en}</span>
                <span className="text-[11px] text-silver/50">{L('خطوة', 'step')} {effOrder}/{total}</span>
                <span className="ms-auto flex items-center gap-2 text-[10px] text-silver/50">
                    <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded bg-gold/30 inline-block"></i>{L('مكتملة', 'done')}</span>
                    <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded bg-gold inline-block"></i>{L('الحالية', 'current')}</span>
                    <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded border border-gold/40 inline-block"></i>{L('التالية', 'next')}</span>
                </span>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-2">
                {data.stages.map(s => {
                    const done = s.order < effOrder;
                    const current = s.key === data.effective;
                    const isNext = nextKeys.has(s.key);
                    const gatedBlocked = s.gate && !data.internalApproved && isNext;
                    const cls = current
                        ? 'bg-gold text-darkwhite border-gold'
                        : done
                            ? 'bg-gold/20 text-gold border-gold/30'
                            : isNext
                                ? 'bg-[#1a1a1e] text-silver border-gold/40'
                                : 'bg-[#1a1a1e] text-silver/40 border-silver/15';
                    return (
                        <div key={s.key} className="flex flex-col items-center gap-1 flex-shrink-0">
                            <div className={`px-2.5 py-1.5 rounded-lg border text-[11px] whitespace-nowrap ${cls}`} title={s.gate ? L('مرحلة تتطلب اعتماداً داخلياً', 'Requires internal approval') : ''}>
                                {s.gate && '🔒 '}{isAr ? s.ar : s.en}
                            </div>
                            {isNext && (
                                <button
                                    onClick={() => act({ to: s.key })}
                                    disabled={busy || gatedBlocked}
                                    title={gatedBlocked ? L('يتطلب اعتماداً داخلياً معتمداً أولاً', 'Needs an approved internal approval first') : ''}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-green-600/80 text-white hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed">
                                    {L('تقدّم ←', 'Advance →')}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-1 flex flex-wrap gap-x-4 text-[10px] text-silver/50">
                <span>{L('المرحلة الحالية', 'Current')}: <span className="text-gold">{isAr ? (data.stages.find(s => s.key === data.effective)?.ar) : (data.stages.find(s => s.key === data.effective)?.en)}</span></span>
                <span>{L('المُشتقّة من السجلات', 'Derived')}: {data.derived}</span>
                {data.stored && <span>{L('المخزّنة', 'Stored')}: {data.stored}</span>}
            </div>
            {err && <div className="mt-1 text-xs text-red-400">{err}</div>}

            {showLog && (
                <div className="mt-2 border-t border-silver/15 pt-2 space-y-1 max-h-40 overflow-y-auto">
                    {data.log.length === 0 && <p className="text-silver/40 text-xs">{L('لا يوجد سجل بعد.', 'No log yet.')}</p>}
                    {data.log.map((l, i) => (
                        <div key={i} className="text-[11px] text-silver/70">
                            <span className="text-gold">{l.to_stage}</span>
                            {l.from_stage && <span className="text-silver/40"> ← {l.from_stage}</span>}
                            {l.actor && <span className="text-silver/40"> · {l.actor}</span>}
                            {l.note && <span className="text-silver/40"> · {l.note}</span>}
                            <span className="text-silver/30"> · {new Date(l.created_at).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
