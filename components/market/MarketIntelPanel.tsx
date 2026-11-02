'use client';

// Per-item market intelligence shown beside a product/service: current/previous/avg/min/max,
// % change, a trend sparkline, last-update + sources, and (for management/finance) a quick
// snapshot recorder. Reads/writes /api/market/item. Never touches the item's sell_price.
import { useCallback, useEffect, useState } from 'react';

interface Intel {
    current_price: number | null;
    previous_price: number | null;
    pct_change: number | null;
    avg_price: number | null;
    min_price: number | null;
    max_price: number | null;
    snapshot_count: number;
    last_update: string | null;
    currency: string | null;
    sources: (string | null)[] | null;
}
interface Snapshot {
    id: number; source: string | null; source_url: string | null;
    price: number; currency: string; note: string | null;
    recorded_by: string | null; captured_at: string;
}

interface Props {
    itemType: 'product' | 'service';
    itemId: string;
    language?: 'ar' | 'en';
}

const SOURCES = ['amazon', 'egyprices', 'qarenly', 'upwork', 'fiverr', 'manual'] as const;

function fmt(n: number | null | undefined, cur?: string | null) {
    if (n == null) return '—';
    return `${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${cur || 'EGP'}`;
}

// Tiny inline sparkline from oldest→newest prices.
function Sparkline({ points }: { points: number[] }) {
    if (points.length < 2) return null;
    const w = 160, h = 36, pad = 2;
    const min = Math.min(...points), max = Math.max(...points);
    const span = max - min || 1;
    const step = (w - pad * 2) / (points.length - 1);
    const d = points.map((p, i) => {
        const x = pad + i * step;
        const y = h - pad - ((p - min) / span) * (h - pad * 2);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const up = points[points.length - 1] >= points[0];
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
            <path d={d} fill="none" stroke={up ? '#4ade80' : '#f87171'} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

export default function MarketIntelPanel({ itemType, itemId, language = 'ar' }: Props) {
    const ar = language === 'ar';
    const [intel, setIntel] = useState<Intel | null>(null);
    const [history, setHistory] = useState<Snapshot[]>([]);
    const [canRecord, setCanRecord] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [open, setOpen] = useState(false);

    const [price, setPrice] = useState('');
    const [source, setSource] = useState<typeof SOURCES[number]>('manual');
    const [url, setUrl] = useState('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await fetch(`/api/market/item?type=${itemType}&id=${encodeURIComponent(itemId)}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { setError(data.error || 'Error'); return; }
            setIntel(data.intel);
            setHistory(data.history || []);
            setCanRecord(!!data.canRecord);
        } catch {
            setError(ar ? 'تعذّر تحميل بيانات السوق' : 'Failed to load market data');
        } finally { setLoading(false); }
    }, [itemType, itemId, ar]);

    useEffect(() => { if (itemId) load(); }, [itemId, load]);

    const record = async () => {
        const p = parseFloat(price);
        if (!Number.isFinite(p) || p < 0) { setError(ar ? 'أدخل سعراً صحيحاً' : 'Enter a valid price'); return; }
        setSaving(true); setError('');
        try {
            const res = await fetch('/api/market/item', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_type: itemType, item_id: itemId, price: p, source, source_url: url, note }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { setError(data.error || 'Error'); return; }
            setPrice(''); setUrl(''); setNote('');
            await load();
        } finally { setSaving(false); }
    };

    const trend = history.slice().reverse().map(s => Number(s.price)); // oldest→newest
    const pct = intel?.pct_change;
    const pctColor = pct == null ? 'text-silver/60' : pct > 0 ? 'text-green-400' : pct < 0 ? 'text-red-400' : 'text-silver/60';

    return (
        <div className="rounded-lg border border-silver/20 bg-[#0a0a0c]/60 p-3" dir={ar ? 'rtl' : 'ltr'}>
            <button type="button" onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between text-gold text-sm font-bold">
                <span>📊 {ar ? 'ذكاء السوق' : 'Market intelligence'}</span>
                <span className="text-silver/50 text-xs">{open ? '▲' : '▼'}</span>
            </button>

            {open && (
                <div className="mt-3 space-y-3">
                    {loading && <p className="text-silver/50 text-xs">{ar ? 'جارِ التحميل…' : 'Loading…'}</p>}
                    {!loading && !intel && !error && (
                        <p className="text-silver/50 text-xs">{ar ? 'لا توجد أسعار سوق مسجّلة بعد لهذا الصنف.' : 'No market prices recorded for this item yet.'}</p>
                    )}

                    {intel && (
                        <>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded bg-[#1a1a1e] p-2">
                                    <div className="text-[10px] text-silver/50">{ar ? 'الحالي' : 'Current'}</div>
                                    <div className="text-silver text-sm font-bold">{fmt(intel.current_price, intel.currency)}</div>
                                </div>
                                <div className="rounded bg-[#1a1a1e] p-2">
                                    <div className="text-[10px] text-silver/50">{ar ? 'السابق' : 'Previous'}</div>
                                    <div className="text-silver text-sm">{fmt(intel.previous_price, intel.currency)}</div>
                                </div>
                                <div className="rounded bg-[#1a1a1e] p-2">
                                    <div className="text-[10px] text-silver/50">{ar ? 'التغيّر' : 'Change'}</div>
                                    <div className={`text-sm font-bold ${pctColor}`}>{pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct}%`}</div>
                                </div>
                                <div className="rounded bg-[#1a1a1e] p-2">
                                    <div className="text-[10px] text-silver/50">{ar ? 'المتوسط' : 'Average'}</div>
                                    <div className="text-silver text-sm">{fmt(intel.avg_price, intel.currency)}</div>
                                </div>
                                <div className="rounded bg-[#1a1a1e] p-2">
                                    <div className="text-[10px] text-silver/50">{ar ? 'الأدنى' : 'Min'}</div>
                                    <div className="text-silver text-sm">{fmt(intel.min_price, intel.currency)}</div>
                                </div>
                                <div className="rounded bg-[#1a1a1e] p-2">
                                    <div className="text-[10px] text-silver/50">{ar ? 'الأعلى' : 'Max'}</div>
                                    <div className="text-silver text-sm">{fmt(intel.max_price, intel.currency)}</div>
                                </div>
                            </div>

                            {trend.length >= 2 && (
                                <div className="flex items-center justify-between rounded bg-[#1a1a1e] p-2">
                                    <span className="text-[10px] text-silver/50">{ar ? 'الاتجاه' : 'Trend'}</span>
                                    <Sparkline points={trend} />
                                </div>
                            )}

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-silver/50">
                                <span>{ar ? 'عدد القراءات' : 'Readings'}: {intel.snapshot_count}</span>
                                {intel.last_update && <span>{ar ? 'آخر تحديث' : 'Last update'}: {new Date(intel.last_update).toLocaleDateString()}</span>}
                                {intel.sources && intel.sources.filter(Boolean).length > 0 && (
                                    <span>{ar ? 'المصادر' : 'Sources'}: {intel.sources.filter(Boolean).join(', ')}</span>
                                )}
                            </div>
                        </>
                    )}

                    {error && <div className="text-red-400 text-xs">{error}</div>}

                    {canRecord && (
                        <div className="rounded border border-silver/15 p-2 space-y-2">
                            <div className="text-[11px] text-silver/70">{ar ? 'تسجيل سعر سوق جديد' : 'Record a new market price'}</div>
                            <div className="flex flex-wrap gap-2">
                                <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                                    placeholder={ar ? 'السعر' : 'Price'}
                                    className="w-24 px-2 py-1 bg-[#0a0a0c] border border-silver/30 rounded text-silver text-xs focus:outline-none focus:border-gold" />
                                <select value={source} onChange={e => setSource(e.target.value as typeof SOURCES[number])}
                                    className="px-2 py-1 bg-[#0a0a0c] border border-silver/30 rounded text-silver text-xs focus:outline-none focus:border-gold">
                                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <input value={url} onChange={e => setUrl(e.target.value)} placeholder={ar ? 'رابط (اختياري)' : 'URL (optional)'}
                                    className="flex-1 min-w-[120px] px-2 py-1 bg-[#0a0a0c] border border-silver/30 rounded text-silver text-xs focus:outline-none focus:border-gold" />
                            </div>
                            <div className="flex gap-2">
                                <input value={note} onChange={e => setNote(e.target.value)} placeholder={ar ? 'ملاحظة (اختياري)' : 'Note (optional)'}
                                    className="flex-1 px-2 py-1 bg-[#0a0a0c] border border-silver/30 rounded text-silver text-xs focus:outline-none focus:border-gold" />
                                <button type="button" onClick={record} disabled={saving}
                                    className="px-3 py-1 bg-gold text-darkwhite rounded text-xs font-bold hover:bg-yellow-600 disabled:opacity-50">
                                    {saving ? '…' : (ar ? 'تسجيل' : 'Record')}
                                </button>
                            </div>
                            <p className="text-[10px] text-silver/40">{ar ? 'بيانات مرجعية للسوق — لا تغيّر سعر البيع المعتمد.' : 'Market reference only — never changes the approved sell price.'}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
