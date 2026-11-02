'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';

interface Indicator {
    id: string; key: string; label_ar: string | null; label_en: string | null; value: number | null;
    unit: string | null; currency: string | null; category: string | null; source: string | null;
    source_url: string | null; verification: string; previous_value: number | null; updated_at: string;
}
interface Src { authority: string | null; topic: string | null; usage_note: string | null; url: string | null; verified: boolean; }

const VERIF: Record<string, { ar: string; en: string; cls: string }> = {
    verified: { ar: 'مُتحقَّق', en: 'Verified', cls: 'bg-green-500/20 text-green-300' },
    manual: { ar: 'يدوي', en: 'Manual', cls: 'bg-silver/20 text-silver' },
    needs_verification: { ar: 'يحتاج تحقّقاً', en: 'Needs check', cls: 'bg-yellow-500/20 text-yellow-300' },
    failed: { ar: 'فشل المصدر', en: 'Source failed', cls: 'bg-red-500/20 text-red-300' },
};

export default function MarketPage() {
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [indicators, setIndicators] = useState<Indicator[]>([]);
    const [sources, setSources] = useState<Src[]>([]);
    const [canManage, setCanManage] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [msg, setMsg] = useState('');
    const [history, setHistory] = useState<{ key: string; rows: any[] } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/market/indicators');
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            setIndicators(j.indicators || []); setSources(j.sources || []); setCanManage(!!j.canManage);
        } catch (e: any) { setErr(e.message); }
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const updateAll = async () => {
        setBusy(true); setErr(''); setMsg('');
        try {
            const res = await fetch('/api/market/update-all', { method: 'POST' });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            const ok = (j.results || []).filter((r: any) => r.ok).length;
            const failed = (j.results || []).filter((r: any) => r.verification === 'failed').length;
            setMsg(L(`تم التحديث: ${ok} مؤشر${failed ? ` · ${failed} مصدر فشل (لم تتأثر البقية)` : ''}`, `Updated ${ok}${failed ? ` · ${failed} source(s) failed (others unaffected)` : ''}`));
            load();
        } catch (e: any) { setErr(e.message); }
        setBusy(false);
    };

    const openHistory = async (key: string) => {
        try {
            const res = await fetch(`/api/market/indicators?key=${encodeURIComponent(key)}`);
            const j = await res.json();
            setHistory({ key, rows: j.history || [] });
        } catch (e: any) { setErr(e.message); }
    };

    const nf = (n: number | null) => n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });
    const pct = (cur: number | null, prev: number | null) => (prev && cur != null && prev !== 0) ? ((cur - prev) / prev * 100) : null;

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-3 gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#DBA935]">{L('بيانات السوق والمؤشرات', 'Market Data & Indicators')}</h1>
                        <p className="text-[#C0C0C0] text-sm mt-1">{L('مؤشرات مرجعية بمصادرها وتاريخها — لا تُخفّض أسعار البيع المعتمدة تلقائياً.', 'Sourced reference indicators with history — never auto-reduces approved selling prices.')}</p>
                    </div>
                    {canManage && (
                        <button onClick={updateAll} disabled={busy} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm disabled:opacity-50">
                            {busy ? L('جارٍ التحديث...', 'Updating...') : L('⟳ تحديث كل بيانات السوق', '⟳ Update All Market Data')}
                        </button>
                    )}
                </div>
                {err && <div className="mb-3 text-red-400 text-sm">{err}</div>}
                {msg && <div className="mb-3 text-green-400 text-sm">{msg}</div>}

                <div className="rounded-xl border border-[#DBA935]/20 bg-[#DBA935]/5 px-3 py-2 mb-4 text-xs text-[#C0C0C0]">
                    {L('قاعدة محمية: انخفاض السوق أو هبوط العملة لا يخفض سعر البيع المعتمد تلقائياً. أي تخفيض يتطلب اعتماداً مسبّباً، والحد الأدنى محسوب من التكلفة الفعلية.', 'Protected rule: a market drop or currency fall never auto-lowers an approved sell price. Any reduction needs an authorized, reasoned approval; the floor is cost-based.')}
                </div>

                {loading ? <div className="text-center py-16 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</div> : (
                    <div className="overflow-x-auto mb-6">
                        <table className="w-full text-sm text-[#C0C0C0]">
                            <thead>
                                <tr className="text-[#DBA935] text-xs border-b border-[#DBA935]/20">
                                    <th className="py-2 px-3 text-start">{L('المؤشر', 'Indicator')}</th>
                                    <th className="py-2 px-3 text-start">{L('القيمة', 'Value')}</th>
                                    <th className="py-2 px-3 text-start">{L('التغيّر', 'Change')}</th>
                                    <th className="py-2 px-3 text-start">{L('الحالة', 'Status')}</th>
                                    <th className="py-2 px-3 text-start">{L('المصدر', 'Source')}</th>
                                    <th className="py-2 px-3 text-start">{L('آخر تحديث', 'Updated')}</th>
                                    <th className="py-2 px-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {indicators.map(ind => {
                                    const v = VERIF[ind.verification] || VERIF.manual;
                                    const p = pct(ind.value, ind.previous_value);
                                    return (
                                        <tr key={ind.id} className="border-b border-white/5 hover:bg-[#DBA935]/5">
                                            <td className="py-2.5 px-3">{isAr ? ind.label_ar : ind.label_en}</td>
                                            <td className="py-2.5 px-3 font-mono">{nf(ind.value)} <span className="text-[10px] text-[#C0C0C0]/60">{ind.unit}</span></td>
                                            <td className={`py-2.5 px-3 text-xs ${p == null ? '' : p > 0 ? 'text-green-400' : p < 0 ? 'text-red-400' : ''}`}>{p == null ? '—' : `${p > 0 ? '▲' : p < 0 ? '▼' : ''} ${Math.abs(p).toFixed(2)}%`}</td>
                                            <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-[11px] ${v.cls}`}>{isAr ? v.ar : v.en}</span></td>
                                            <td className="py-2.5 px-3 text-xs">{ind.source_url ? <a href={ind.source_url} target="_blank" rel="noopener noreferrer" className="text-[#DBA935] hover:underline">{ind.source}</a> : ind.source || '—'}</td>
                                            <td className="py-2.5 px-3 text-xs">{ind.updated_at ? new Date(ind.updated_at).toLocaleDateString() : '—'}</td>
                                            <td className="py-2.5 px-3"><button onClick={() => openHistory(ind.key)} className="text-[#DBA935] text-xs hover:underline whitespace-nowrap">📈 {L('سجل الأسعار', 'History')}</button></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <h2 className="text-[#DBA935] font-bold mb-2 text-sm">{L('المصادر والمراجع المعتمدة', 'Approved sources & references')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {sources.map((s, i) => (
                        <div key={i} className="bg-black/20 rounded-lg p-2 text-xs">
                            <div className="text-white font-bold">{s.authority}</div>
                            <div className="text-[#C0C0C0]">{s.topic}</div>
                            {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[#DBA935] hover:underline break-all" dir="ltr">{s.url}</a>}
                        </div>
                    ))}
                </div>
            </div>

            {history && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={() => setHistory(null)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 rounded-2xl shadow-2xl border border-[#DBA935]/30 w-full max-w-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]">
                            <h2 className="text-[#DBA935] font-bold">{L('سجل الأسعار', 'Price history')} — {history.key}</h2>
                            <button onClick={() => setHistory(null)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-4">
                            {history.rows.length === 0 ? <p className="text-[#C0C0C0] text-sm">{L('لا يوجد سجل بعد — اضغط «تحديث كل بيانات السوق».', 'No history yet — run "Update All Market Data".')}</p> : (
                                <table className="w-full text-xs text-[#C0C0C0]">
                                    <thead><tr className="text-[#DBA935] border-b border-[#DBA935]/20">
                                        <th className="py-1.5 px-2 text-start">{L('التاريخ', 'Date')}</th>
                                        <th className="py-1.5 px-2 text-start">{L('السابق', 'Prev')}</th>
                                        <th className="py-1.5 px-2 text-start">{L('الحالي', 'Current')}</th>
                                        <th className="py-1.5 px-2 text-start">{L('التغيّر', 'Change')}</th>
                                        <th className="py-1.5 px-2 text-start">{L('الحالة', 'Status')}</th>
                                    </tr></thead>
                                    <tbody>
                                        {history.rows.map((r, i) => (
                                            <tr key={i} className="border-b border-white/5">
                                                <td className="py-1.5 px-2">{new Date(r.recorded_at).toLocaleString()}</td>
                                                <td className="py-1.5 px-2 font-mono">{nf(r.previous_value)}</td>
                                                <td className="py-1.5 px-2 font-mono">{nf(r.value)}</td>
                                                <td className={`py-1.5 px-2 ${r.pct_change > 0 ? 'text-green-400' : r.pct_change < 0 ? 'text-red-400' : ''}`}>{r.pct_change == null ? '—' : `${Number(r.pct_change).toFixed(2)}%`}</td>
                                                <td className="py-1.5 px-2">{(VERIF[r.verification] || VERIF.manual)[isAr ? 'ar' : 'en']}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
