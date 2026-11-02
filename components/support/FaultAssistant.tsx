'use client';

// AI fault assistant for field technicians: describe the fault → the knowledge base returns the
// closest VERIFIED procedures (real content, never invented). Plus "open map" (navigate to the
// site via Google Maps using the device GPS) and attach a photo to share with support.
import { useState } from 'react';
import { useLocale } from 'next-intl';

export default function FaultAssistant() {
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [problem, setProblem] = useState('');
    const [item, setItem] = useState('');
    const [res, setRes] = useState<any>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [photo, setPhoto] = useState<string | null>(null);
    const [open, setOpen] = useState<string | null>(null);

    const analyze = async () => {
        if (problem.trim().length < 3) { setErr(L('صف المشكلة أولاً.', 'Describe the problem first.')); return; }
        setBusy(true); setErr(''); setRes(null);
        try {
            const r = await fetch('/api/diagnose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ problem, item_name: item }) });
            const j = await r.json();
            if (!r.ok) { setErr(j.message || j.error || 'Error'); return; }
            setRes(j);
        } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
    };

    const openMap = () => {
        if (!navigator.geolocation) { window.open('https://www.google.com/maps', '_blank', 'noopener'); return; }
        navigator.geolocation.getCurrentPosition(
            p => window.open(`https://www.google.com/maps/search/?api=1&query=${p.coords.latitude},${p.coords.longitude}`, '_blank', 'noopener'),
            () => window.open('https://www.google.com/maps', '_blank', 'noopener'),
            { enableHighAccuracy: true, timeout: 8000 }
        );
    };

    const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; if (!f) return;
        const reader = new FileReader(); reader.onloadend = () => setPhoto(reader.result as string); reader.readAsDataURL(f);
    };

    const field = 'w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver text-sm focus:outline-none focus:border-gold';

    return (
        <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="rounded-xl border border-gold/20 bg-[#1a1a1e] p-4 space-y-3">
                <h3 className="text-gold text-sm font-bold">🤖 {L('مساعد الأعطال الذكي', 'AI fault assistant')}</h3>
                <p className="text-silver/50 text-[11px]">{L('صف العطل بالتفصيل — أقترح لك أقرب الإجراءات المعتمدة من قاعدة المعرفة. ولو في الموقع، افتح الخريطة وأرفق صورة لمشاركتها مع الدعم.', 'Describe the fault — I suggest the closest verified procedures from the knowledge base. On site, open the map and attach a photo to share with support.')}</p>
                <input value={item} onChange={e => setItem(e.target.value)} placeholder={L('الجهاز/الموديل (اختياري)', 'Device/model (optional)')} className={field} />
                <textarea value={problem} onChange={e => setProblem(e.target.value)} rows={3} placeholder={L('مثال: كاميرا UniView لا تعطي صورة بعد انقطاع الكهرباء', 'e.g. UniView camera shows no image after a power cut')} className={field} />
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={analyze} disabled={busy} className="px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold text-sm hover:bg-yellow-600 disabled:opacity-50">{busy ? '…' : L('تحليل', 'Analyze')}</button>
                    <button onClick={openMap} className="px-3 py-2 bg-silver/10 text-silver rounded-lg text-sm hover:bg-silver/20">🗺️ {L('فتح الخريطة', 'Open map')}</button>
                    <label className="px-3 py-2 bg-silver/10 text-silver rounded-lg text-sm hover:bg-silver/20 cursor-pointer">
                        📷 {L('إرفاق صورة', 'Attach photo')}
                        <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
                    </label>
                </div>
                {photo && <img src={photo} alt="fault" className="mt-2 max-h-40 rounded-lg border border-silver/20" />}
                {err && <div className="text-red-400 text-xs">{err}</div>}
            </div>

            {res && (
                <div className="space-y-2">
                    <p className="text-silver/80 text-sm">{res.message}</p>
                    {res.matches.map((m: any) => (
                        <div key={m.code} className="rounded-xl border border-silver/20 bg-[#1a1a1e]">
                            <button onClick={() => setOpen(open === m.code ? null : m.code)} className="w-full text-start p-3 flex items-center justify-between">
                                <span className="text-gold text-sm font-bold">{m.title} <span className="text-silver/40 text-xs">· {m.code}</span></span>
                                <span className="flex items-center gap-2">
                                    {m.verified && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300">{L('معتمد', 'Verified')}</span>}
                                    {m.data_loss_risk && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">⚠ {L('خطر فقد بيانات', 'Data-loss risk')}</span>}
                                    <span className="text-silver/40 text-xs">{open === m.code ? '▲' : '▼'}</span>
                                </span>
                            </button>
                            {open === m.code && (
                                <div className="px-3 pb-3 text-xs text-silver/80 space-y-2 border-t border-silver/10 pt-2">
                                    {m.purpose && <div><span className="text-silver/50">{L('الغرض', 'Purpose')}: </span>{m.purpose}</div>}
                                    {m.instructions && <div><span className="text-silver/50">{L('الخطوات', 'Steps')}:</span><div className="whitespace-pre-wrap mt-0.5">{m.instructions}</div></div>}
                                    {m.command && <div><span className="text-silver/50">{L('الأمر', 'Command')}: </span><code className="bg-[#0a0a0c] px-1.5 py-0.5 rounded text-gold">{m.command}</code></div>}
                                    {m.expected && <div><span className="text-silver/50">{L('النتيجة المتوقعة', 'Expected')}: </span>{m.expected}</div>}
                                    <div className="flex gap-3 text-silver/40">
                                        {m.tier && <span>{L('المستوى', 'Tier')}: {m.tier}</span>}
                                        {m.privilege && <span>{L('الصلاحية', 'Privilege')}: {m.privilege}</span>}
                                        {m.est_minutes != null && <span>{L('الزمن', 'Time')}: ~{m.est_minutes}د</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {res.software?.length > 0 && (
                        <div className="rounded-xl border border-silver/20 bg-[#1a1a1e] p-3">
                            <div className="text-gold text-xs font-bold mb-1">{L('برمجيات ذات صلة', 'Related software')}</div>
                            {res.software.map((s: any, i: number) => (
                                <div key={i} className="text-xs text-silver/80 py-0.5">{s.name} <span className="text-silver/40">— {s.purpose}</span></div>
                            ))}
                        </div>
                    )}
                    {res.matches.length === 0 && (
                        <p className="text-silver/50 text-xs">{L('لا إجراء مطابق — افتح تذكرة دعم وأرفق الصورة.', 'No matching procedure — open a support ticket and attach the photo.')}</p>
                    )}
                </div>
            )}
        </div>
    );
}
