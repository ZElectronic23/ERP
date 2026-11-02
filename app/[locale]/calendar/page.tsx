'use client';

// Personal calendar for every employee — their meetings, tasks, work and project events in a month
// view. Scoped server-side to the signed-in employee only (each sees their own calendar).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';

const TYPE: Record<string, { ar: string; en: string; cls: string }> = {
    meeting: { ar: 'اجتماع', en: 'Meeting', cls: 'bg-purple-500/25 text-purple-200' },
    task: { ar: 'مهمة', en: 'Task', cls: 'bg-blue-500/25 text-blue-200' },
    work: { ar: 'عمل', en: 'Work', cls: 'bg-gold/25 text-gold' },
    project: { ar: 'مشروع', en: 'Project', cls: 'bg-green-500/25 text-green-200' },
    other: { ar: 'أخرى', en: 'Other', cls: 'bg-silver/20 text-silver' },
};

export default function CalendarPage() {
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const [show, setShow] = useState(false);
    const empty = { title: '', type: 'meeting', start_at: '', end_at: '', location: '', notes: '' };
    const [form, setForm] = useState<any>(empty);
    const [busy, setBusy] = useState(false);
    const [selDay, setSelDay] = useState<number | null>(null);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [linkShow, setLinkShow] = useState(false);
    const [linkForm, setLinkForm] = useState({ provider: 'google', ics_url: '' });
    const [linkMsg, setLinkMsg] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setErr('');
        try {
            const [res, aRes] = await Promise.all([fetch('/api/calendar'), fetch('/api/alerts')]);
            const j = await res.json();
            if (!res.ok) { setErr(j.message || j.error || 'Error'); setData(null); return; }
            setData(j);
            const aj = await aRes.json().catch(() => ({})); if (aRes.ok) setAlerts(aj.alerts || []);
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const subscribe = async () => {
        if (!/^https?:\/\//i.test(linkForm.ics_url)) { setLinkMsg(L('أدخل رابط iCal صحيح', 'Enter a valid iCal URL')); return; }
        setLinkMsg('');
        const r = await fetch('/api/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'subscribe', ...linkForm }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setLinkMsg(j.message || j.error || 'Error'); return; }
        setLinkForm({ provider: 'google', ics_url: '' }); setLinkShow(false); load();
    };
    const unsubscribe = async (id: string) => { await fetch('/api/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unsubscribe', id }) }); load(); };

    const create = async () => {
        if (!form.title.trim() || !form.start_at) { setErr(L('أدخل العنوان ووقت البداية', 'Enter title and start')); return; }
        setBusy(true);
        await fetch('/api/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        setBusy(false); setShow(false); setForm(empty); load();
    };
    const del = async (id: string, source: string) => {
        if (source !== 'event') return; // tasks are managed elsewhere
        await fetch(`/api/calendar?id=${id}`, { method: 'DELETE' }); load();
    };

    const cal = useMemo(() => {
        const y = month.getFullYear(), mo = month.getMonth();
        const startDow = new Date(y, mo, 1).getDay();
        const days = new Date(y, mo + 1, 0).getDate();
        const byDay: Record<number, any[]> = {};
        (data?.events || []).forEach((e: any) => {
            const d = e.start || e.end; if (!d) return;
            const dt = new Date(d);
            if (dt.getFullYear() === y && dt.getMonth() === mo) (byDay[dt.getDate()] ||= []).push(e);
        });
        const cells: ({ day: number; ev: any[] } | null)[] = [];
        for (let i = 0; i < startDow; i++) cells.push(null);
        for (let d = 1; d <= days; d++) cells.push({ day: d, ev: byDay[d] || [] });
        return cells;
    }, [month, data]);

    const monthName = month.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
    const field = 'px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver text-sm focus:outline-none focus:border-gold';
    const selEvents = selDay != null ? (cal.find(c => c && c.day === selDay)?.ev || []) : [];

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gold" dir={isAr ? 'rtl' : 'ltr'}>{L('جارٍ التحميل...', 'Loading...')}</div>;
    if (err || !data) return <div className="min-h-screen flex items-center justify-center text-silver p-6 text-center" dir={isAr ? 'rtl' : 'ltr'}>{err === 'no_employee' || (err && err.includes('موظف')) ? L('لا يوجد ملف موظف مرتبط بحسابك.', 'No employee linked to your account.') : (err || L('لا توجد بيانات', 'No data'))}</div>;

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-alata text-gold">{L('تقويمي', 'My calendar')}</h1>
                        <p className="text-silver/60 text-sm">{data.employee.name} · {L('اجتماعاتك ومهامك وأعمالك ومشاريعك — ما تراه يخصّك وحدك.', 'Your meetings, tasks, work and projects — only yours.')}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { setLinkMsg(''); setLinkShow(true); }} className="px-3 py-2 bg-silver/10 text-silver rounded-lg text-sm hover:bg-silver/20">🔗 {L('ربط تقويم', 'Link calendar')}</button>
                        <button onClick={() => { setForm(empty); setShow(true); }} className="px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold text-sm hover:bg-yellow-600">+ {L('حدث جديد', 'New event')}</button>
                    </div>
                </div>

                {/* Smart alerts graded by importance */}
                {alerts.length > 0 && (
                    <div className="space-y-2">
                        {alerts.map((a, i) => (
                            <div key={i} className={`rounded-xl border p-3 text-sm flex items-center gap-2 ${a.level === 'high' ? 'bg-red-500/10 border-red-500/30 text-red-300' : a.level === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' : 'bg-silver/10 border-silver/20 text-silver'}`}>
                                <span className="text-lg">{a.icon}</span><span>{a.title}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Linked external calendars */}
                {data.subscriptions?.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs">
                        {data.subscriptions.map((s: any) => (
                            <span key={s.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#1a1a1e] border border-silver/20 text-silver/80">
                                🔗 {s.provider}
                                <button onClick={() => unsubscribe(s.id)} className="text-red-400 hover:text-red-300">✕</button>
                            </span>
                        ))}
                    </div>
                )}

                <div className="bg-black/30 rounded-2xl border border-gold/20 p-3">
                    <div className="flex items-center justify-between mb-2">
                        <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="px-2 py-1 rounded bg-white/5 text-silver text-sm hover:bg-white/10">‹</button>
                        <span className="text-gold text-sm font-bold">{monthName}</span>
                        <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="px-2 py-1 rounded bg-white/5 text-silver text-sm hover:bg-white/10">›</button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-silver/50 mb-1">
                        {(isAr ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {cal.map((c, i) => (
                            <button key={i} disabled={!c} onClick={() => c && setSelDay(c.day)}
                                className={`min-h-[56px] rounded border p-1 text-start align-top ${!c ? 'border-transparent' : selDay === c.day ? 'border-gold bg-gold/10' : 'border-[#3E3B3F] bg-[#0a0a0c] hover:border-gold/40'}`}>
                                {c && <>
                                    <div className="text-[10px] text-silver/50">{c.day}</div>
                                    {c.ev.slice(0, 3).map((e: any, j: number) => <div key={j} title={e.title} className={`truncate text-[9px] px-1 py-0.5 mt-0.5 rounded ${(TYPE[e.type] || TYPE.other).cls}`}>{e.title}</div>)}
                                    {c.ev.length > 3 && <div className="text-[9px] text-silver/40">+{c.ev.length - 3}</div>}
                                </>}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-silver/50">
                        {Object.entries(TYPE).map(([k, v]) => <span key={k} className="inline-flex items-center gap-1"><i className={`w-2.5 h-2.5 rounded inline-block ${v.cls}`} />{isAr ? v.ar : v.en}</span>)}
                    </div>
                </div>

                {selDay != null && (
                    <div className="bg-[#1a1a1e] rounded-xl border border-silver/20 p-4">
                        <h3 className="text-gold text-sm font-bold mb-2">{L('يوم', 'Day')} {selDay} — {monthName}</h3>
                        {selEvents.length === 0 ? <p className="text-silver/40 text-xs">{L('لا أحداث في هذا اليوم.', 'No events this day.')}</p> :
                            selEvents.map((e: any, i: number) => (
                                <div key={i} className="flex items-center justify-between py-1.5 border-b border-silver/10 last:border-0 text-xs">
                                    <span className="text-silver/80"><span className={`px-1.5 py-0.5 rounded me-2 ${(TYPE[e.type] || TYPE.other).cls}`}>{isAr ? (TYPE[e.type] || TYPE.other).ar : (TYPE[e.type] || TYPE.other).en}</span>{e.title}{e.location ? ` · 📍${e.location}` : ''}{e.project ? ` · ${e.project}` : ''}</span>
                                    {e.source === 'event' && <button onClick={() => del(e.id, e.source)} className="text-red-400 hover:text-red-300">✕</button>}
                                </div>
                            ))}
                    </div>
                )}
            </div>

            {linkShow && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setLinkShow(false)}>
                    <div className="bg-[#1a1a1e]/95 rounded-2xl border border-gold/30 p-6 shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()} dir={isAr ? 'rtl' : 'ltr'}>
                        <h3 className="text-gold font-alata mb-1">🔗 {L('ربط تقويم خارجي', 'Link an external calendar')}</h3>
                        <p className="text-silver/50 text-[11px] mb-3">{L('الصق رابط iCal السري لتقويمك ليُزامَن تلقائياً وتظهر أحداثه الجديدة هنا.', 'Paste your calendar\'s secret iCal URL to auto-sync; new events appear here.')}</p>
                        <div className="space-y-2">
                            <select value={linkForm.provider} onChange={e => setLinkForm({ ...linkForm, provider: e.target.value })} className={`${field} w-full`}>
                                <option value="google">Google Calendar</option>
                                <option value="microsoft">Microsoft / Outlook</option>
                                <option value="apple">Apple iCloud</option>
                                <option value="other">{L('أخرى', 'Other')}</option>
                            </select>
                            <input value={linkForm.ics_url} onChange={e => setLinkForm({ ...linkForm, ics_url: e.target.value })} placeholder="https://...  (.ics)" className={`${field} w-full`} dir="ltr" />
                            <p className="text-silver/40 text-[10px]">
                                {linkForm.provider === 'google' && L('Google: الإعدادات ← تقويمك ← «العنوان السري بتنسيق iCal».', 'Google: Settings → your calendar → "Secret address in iCal format".')}
                                {linkForm.provider === 'microsoft' && L('Outlook: الإعدادات ← التقويم ← التقاويم المشتركة ← نشر ← رابط ICS.', 'Outlook: Settings → Calendar → Shared calendars → Publish → ICS link.')}
                                {linkForm.provider === 'apple' && L('iCloud: مشاركة التقويم كعام ← انسخ الرابط (webcal → https).', 'iCloud: share calendar publicly → copy link (webcal → https).')}
                            </p>
                            {linkMsg && <p className="text-red-400 text-xs">{linkMsg}</p>}
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={subscribe} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold text-sm hover:bg-yellow-600">{L('ربط', 'Link')}</button>
                            <button onClick={() => setLinkShow(false)} className="px-4 py-2 bg-silver/10 text-silver rounded-lg text-sm">{L('إلغاء', 'Cancel')}</button>
                        </div>
                    </div>
                </div>
            )}

            {show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShow(false)}>
                    <div className="bg-[#1a1a1e]/95 rounded-2xl border border-gold/30 p-6 shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
                        <h3 className="text-gold font-alata mb-3">{L('حدث جديد', 'New event')}</h3>
                        <div className="space-y-2">
                            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={L('العنوان', 'Title')} className={`${field} w-full`} />
                            <div className="grid grid-cols-2 gap-2">
                                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={`${field} w-full`}>
                                    {Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{isAr ? v.ar : v.en}</option>)}
                                </select>
                                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder={L('المكان', 'Location')} className={`${field} w-full`} />
                                <label className="text-silver/50 text-xs">{L('من', 'Start')}<input type="datetime-local" value={form.start_at} onChange={e => setForm({ ...form, start_at: e.target.value })} className={`${field} w-full mt-0.5`} /></label>
                                <label className="text-silver/50 text-xs">{L('إلى', 'End')}<input type="datetime-local" value={form.end_at} onChange={e => setForm({ ...form, end_at: e.target.value })} className={`${field} w-full mt-0.5`} /></label>
                            </div>
                            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder={L('ملاحظات', 'Notes')} className={`${field} w-full`} />
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={create} disabled={busy} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold text-sm hover:bg-yellow-600 disabled:opacity-50">{busy ? '…' : L('حفظ', 'Save')}</button>
                            <button onClick={() => setShow(false)} className="px-4 py-2 bg-silver/10 text-silver rounded-lg text-sm">{L('إلغاء', 'Cancel')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
