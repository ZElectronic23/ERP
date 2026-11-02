'use client';

// Client self-service portal. Everything is the signed-in client's OWN data (scoped server-side):
// invoices (paid vs outstanding), price offers, warranties, projects with their current journey
// stage, and their requests/tickets. They can request a new service/product or open a support
// ticket (optionally tied to a product/service they pick from the catalog).
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';

type Tab = 'overview' | 'invoices' | 'warranties' | 'projects' | 'requests' | 'profile';

// Where a client request currently is (the lifecycle the owner asked to expose).
const REQ_STATUS: Record<string, { ar: string; en: string; cls: string; step: number }> = {
    submitted: { ar: 'قيد المراجعة', en: 'Under review', cls: 'bg-blue-500/20 text-blue-300', step: 1 },
    planning: { ar: 'يُخطَّط كمشروع', en: 'Being planned', cls: 'bg-indigo-500/20 text-indigo-300', step: 2 },
    survey: { ar: 'في المعاينة', en: 'Site survey', cls: 'bg-purple-500/20 text-purple-300', step: 3 },
    waiting: { ar: 'في الانتظار', en: 'Waiting', cls: 'bg-yellow-500/20 text-yellow-300', step: 4 },
    support_received: { ar: 'استقبله الدعم الفني', en: 'Received by support', cls: 'bg-cyan-500/20 text-cyan-300', step: 5 },
    in_progress: { ar: 'جارٍ العمل', en: 'In progress', cls: 'bg-orange-500/20 text-orange-300', step: 6 },
    closed: { ar: 'مكتمل', en: 'Completed', cls: 'bg-green-500/20 text-green-300', step: 7 },
    open: { ar: 'مفتوح', en: 'Open', cls: 'bg-blue-500/20 text-blue-300', step: 1 },
};

const STAGE_AR: Record<string, string> = {
    lead: 'عميل محتمل', customer: 'عميل فعلي', survey: 'مسح فني', assessment: 'تقييم فني', project: 'مشروع',
    pricing_quotation: 'تسعير وعرض', internal_approval: 'اعتماد داخلي', customer_approval: 'موافقتك', contract: 'تعاقد',
    advance_payment: 'دفعة مقدمة', procurement: 'توريد', execution: 'تنفيذ', acceptance: 'قبول', invoicing: 'فوترة',
    collection: 'تحصيل', handover: 'تسليم', warranty: 'ضمان', evaluation: 'تقييم',
};

export default function ClientPortal() {
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [tab, setTab] = useState<Tab>('overview');

    // new request
    const [kind, setKind] = useState<'service' | 'product' | 'support'>('service');
    const [subject, setSubject] = useState('');
    const [desc, setDesc] = useState('');
    const [itemSearch, setItemSearch] = useState('');
    const [itemResults, setItemResults] = useState<any[]>([]);
    const [picked, setPicked] = useState<any>(null);
    const [sending, setSending] = useState(false);
    const [reqMsg, setReqMsg] = useState('');

    // detail modals (full document fetched on open)
    const [openInv, setOpenInv] = useState<any>(null);
    const [openWar, setOpenWar] = useState<any>(null);
    const [detail, setDetail] = useState<any>(null);
    const [detailBusy, setDetailBusy] = useState(false);

    const openDoc = async (row: any, kind: 'inv' | 'war') => {
        if (kind === 'inv') setOpenInv(row); else setOpenWar(row);
        setDetail(null); setDetailBusy(true);
        try {
            const r = await fetch(`/api/portal/client?invoice=${row.id}`);
            const j = await r.json();
            if (r.ok) setDetail(j);
        } finally { setDetailBusy(false); }
    };
    const closeDoc = () => { setOpenInv(null); setOpenWar(null); setDetail(null); };
    const printDoc = () => {
        const el = document.getElementById('client-doc-print');
        if (!el) return;
        const w = window.open('', '_blank'); if (!w) return;
        w.document.write(`<!DOCTYPE html><html dir="${isAr ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${isAr ? 'مستند' : 'Document'}</title>
<style>body{font-family:'Cairo',sans-serif;color:#1a1a1a;background:#fff;padding:16px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:${isAr ? 'right' : 'left'};font-size:12px}th{background:#f3ead2}h1{color:#9a7a1e}@media print{@page{margin:12mm}}</style></head><body>${el.innerHTML}</body></html>`);
        w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400);
    };

    // profile self-update
    const [prof, setProf] = useState<any>({ mobile: '', email: '', address: '', commercial_reg_no: '', id_card_no: '', lat: null, lng: null });
    const [profMsg, setProfMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [profBusy, setProfBusy] = useState(false);
    const [locBusy, setLocBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true); setErr('');
        try {
            const res = await fetch('/api/portal/client');
            const j = await res.json();
            if (!res.ok) { setErr(j.message || j.error || 'Error'); setData(null); return; }
            setData(j);
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (data?.profile) setProf((p: any) => ({ ...p, ...data.profile })); }, [data]);

    const confirmLocation = () => {
        if (!navigator.geolocation) { setProfMsg({ ok: false, text: L('جهازك لا يدعم تحديد الموقع.', 'Geolocation not supported.') }); return; }
        setLocBusy(true); setProfMsg(null);
        navigator.geolocation.getCurrentPosition(
            pos => { setProf((p: any) => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude })); setLocBusy(false); setProfMsg({ ok: true, text: L('تم تحديد موقعك ✓ (سيُراجَع مع بياناتك)', 'Location captured ✓ (reviewed with your data)') }); },
            () => { setLocBusy(false); setProfMsg({ ok: false, text: L('فعّل خدمة الموقع واسمح بالوصول.', 'Enable location and allow access.') }); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };
    const submitProfile = async () => {
        setProfBusy(true); setProfMsg(null);
        const res = await fetch('/api/portal/client', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'profile_update', ...prof }) });
        const j = await res.json().catch(() => ({}));
        setProfBusy(false);
        setProfMsg({ ok: res.ok, text: j.message || (res.ok ? L('تم الإرسال', 'Sent') : L('خطأ', 'Error')) });
        if (res.ok) load();
    };

    const searchItems = async (q: string) => {
        setItemSearch(q);
        if (!q.trim()) { setItemResults([]); return; }
        try {
            const res = await fetch(`/api/documents/items?type=${kind === 'product' ? 'product' : kind === 'service' ? 'service' : 'all'}&search=${encodeURIComponent(q)}&limit=15`);
            const j = await res.json();
            setItemResults(j.items || []);
        } catch { setItemResults([]); }
    };

    const submit = async () => {
        if (!subject.trim()) { setReqMsg(L('اكتب موضوع الطلب', 'Enter a subject')); return; }
        setSending(true); setReqMsg('');
        const res = await fetch('/api/portal/client', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind, subject, description: desc, item_type: picked?.item_type || null, item_ref: picked?.id || null, item_name: picked?.name || null }),
        });
        const j = await res.json().catch(() => ({}));
        setSending(false);
        if (!res.ok) { setReqMsg(j.message || j.error || 'Error'); return; }
        setSubject(''); setDesc(''); setPicked(null); setItemSearch(''); setItemResults([]);
        setReqMsg(j.message || L('تم الإرسال ✓', 'Sent ✓')); load();
    };

    const money = (n: any) => `${Number(n || 0).toLocaleString()} ${L('ج.م', 'EGP')}`;
    const fmtD = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : '—');
    const card = 'rounded-xl border border-silver/20 bg-[#1a1a1e] p-4';

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gold" dir={isAr ? 'rtl' : 'ltr'}>{L('جارٍ التحميل...', 'Loading...')}</div>;
    if (err || !data) return <div className="min-h-screen flex items-center justify-center text-silver p-6 text-center" dir={isAr ? 'rtl' : 'ltr'}>{err || L('لا توجد بيانات', 'No data')}</div>;

    const TABS: [Tab, string][] = [
        ['overview', L('نظرة عامة', 'Overview')], ['invoices', L('فواتيري', 'Invoices')],
        ['warranties', L('الضمانات', 'Warranties')], ['projects', L('أعمالي', 'My work')], ['requests', L('طلباتي والدعم', 'Requests & support')],
        ['profile', L('بياناتي', 'My data')],
    ];
    const reqStat = (s: string) => REQ_STATUS[s] || REQ_STATUS.submitted;

    const initials = (data.client.name || '').trim().slice(0, 1) || '◆';
    const hour = new Date().getHours();
    const greet = hour < 12 ? L('صباح الخير', 'Good morning') : hour < 18 ? L('مساء الخير', 'Good afternoon') : L('مساء الخير', 'Good evening');

    return (
        <div className="min-h-screen p-4 md:p-6" style={{ backgroundImage: "url('/assets/images/BG.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} dir={isAr ? 'rtl' : 'ltr'}>
            <div className="max-w-5xl mx-auto space-y-5">
                {/* Hero */}
                <div className="relative overflow-hidden rounded-3xl border border-gold/30 p-6 md:p-7 shadow-2xl"
                    style={{ background: 'linear-gradient(135deg, rgba(219,169,53,0.18), rgba(10,10,12,0.6) 55%)' }}>
                    <div className="absolute -top-10 -inset-inline-end-10 w-40 h-40 rounded-full bg-gold/10 blur-3xl" />
                    <div className="relative flex items-center gap-4 flex-wrap">
                        <div className="w-14 h-14 rounded-2xl bg-gold text-darkwhite flex items-center justify-center text-2xl font-alata shadow-lg shrink-0">{initials}</div>
                        <div className="flex-1 min-w-[200px]">
                            <p className="text-gold/80 text-xs">{greet} 👋</p>
                            <h1 className="text-2xl md:text-3xl font-alata text-white leading-tight">{data.client.name}</h1>
                            <p className="text-silver/60 text-xs mt-1">{L('حسابك لدى Z.Electronic — تابع أعمالك وفواتيرك واطلب خدماتك في مكان واحد.', 'Your Z.Electronic account — track your work, invoices and requests in one place.')}</p>
                        </div>
                        {data.outstanding.count > 0 && (
                            <button onClick={() => setTab('invoices')} className="rounded-2xl bg-red-500/15 border border-red-500/40 px-4 py-3 text-center hover:bg-red-500/25 transition">
                                <div className="text-red-300 text-[11px]">{L('مستحقات عليك', 'You owe')}</div>
                                <div className="text-red-200 font-bold">{money(data.outstanding.total)}</div>
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 flex-wrap">
                    {TABS.map(([k, lbl]) => (
                        <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-full text-sm font-bold transition ${tab === k ? 'bg-gold text-darkwhite shadow-lg' : 'bg-white/5 text-silver border border-gold/20 hover:bg-gold/10'}`}>{lbl}</button>
                    ))}
                </div>

                {tab === 'overview' && (() => {
                    const activeWarranties = data.warranties.filter((w: any) => w.end && new Date(w.end) >= new Date()).length;
                    const openReqs = data.requests.filter((r: any) => r.status !== 'closed').length;
                    const tiles: { key: Tab; icon: string; label: string; value: string | number; sub?: string; accent: string }[] = [
                        { key: 'invoices', icon: '🧾', label: L('فواتيري', 'Invoices'), value: data.invoices.length, sub: L('اضغط للتفاصيل', 'tap for details'), accent: 'text-gold' },
                        { key: 'invoices', icon: '💰', label: L('مستحقات غير مسدّدة', 'Outstanding'), value: data.outstanding.count, sub: money(data.outstanding.total), accent: data.outstanding.count ? 'text-red-400' : 'text-green-400' },
                        { key: 'warranties', icon: '🛡️', label: L('ضمانات سارية', 'Active warranties'), value: `${activeWarranties}/${data.warranties.length}`, accent: 'text-gold' },
                        { key: 'projects', icon: '🏗️', label: L('أعمالي الجارية', 'Active work'), value: data.projects.length, accent: 'text-gold' },
                        { key: 'requests', icon: '🛟', label: L('طلباتي المفتوحة', 'Open requests'), value: openReqs, sub: L('خدمات ودعم', 'services & support'), accent: 'text-gold' },
                        { key: 'profile', icon: '👤', label: L('بياناتي', 'My data'), value: data.pendingUpdate ? L('قيد المراجعة', 'under review') : L('محدّثة', 'up to date'), accent: data.pendingUpdate ? 'text-yellow-400' : 'text-silver' },
                    ];
                    return (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                            {tiles.map((t, i) => (
                                <button key={i} onClick={() => setTab(t.key)}
                                    className="group text-start rounded-2xl border border-gold/20 bg-[#1a1a1e]/80 backdrop-blur-sm p-4 hover:border-gold/60 hover:-translate-y-0.5 transition-all shadow-lg">
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl">{t.icon}</span>
                                        <span className="text-silver/30 group-hover:text-gold transition">{isAr ? '‹' : '›'}</span>
                                    </div>
                                    <div className={`text-2xl font-bold mt-2 ${t.accent}`}>{t.value}</div>
                                    <div className="text-silver/70 text-xs mt-0.5">{t.label}</div>
                                    {t.sub && <div className="text-silver/40 text-[10px] mt-0.5">{t.sub}</div>}
                                </button>
                            ))}
                        </div>
                    );
                })()}

                {tab === 'invoices' && (
                    <div className="space-y-2">
                        {data.outstanding.count > 0 && (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
                                {L(`لديك ${data.outstanding.count} فاتورة غير مسدّدة بإجمالي ${money(data.outstanding.total)}.`, `You have ${data.outstanding.count} unpaid invoice(s) totaling ${money(data.outstanding.total)}.`)}
                            </div>
                        )}
                        {data.invoices.length === 0 && <p className="text-silver/50 text-sm">{L('لا توجد فواتير.', 'No invoices.')}</p>}
                        {data.invoices.map((d: any) => (
                            <button key={d.id} onClick={() => openDoc(d, 'inv')} className={`${card} w-full text-start flex items-center justify-between gap-3 flex-wrap hover:border-gold/40 transition`}>
                                <div><div className="text-silver text-sm font-bold">{d.doc_number}</div><div className="text-silver/50 text-xs">{fmtD(d.doc_date)}{d.project_id ? ` · ${d.project_id}` : ''}</div></div>
                                <div className="text-end">
                                    <div className="text-gold font-bold">{money(d.total)}</div>
                                    <span className={`text-xs px-2 py-0.5 rounded ${d.paid ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{d.paid ? L('مسدّدة', 'Paid') : L('غير مسدّدة', 'Unpaid')}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {tab === 'warranties' && (
                    <div className="space-y-2">
                        {data.warranties.length === 0 && <p className="text-silver/50 text-sm">{L('لا توجد ضمانات مسجّلة.', 'No warranties on record.')}</p>}
                        {data.warranties.map((w: any, i: number) => {
                            const active = w.end ? new Date(w.end) >= new Date() : null;
                            return (
                                <button key={i} onClick={() => openDoc({ ...w, active }, 'war')} className={`${card} w-full text-start flex items-center justify-between hover:border-gold/40 transition`}>
                                    <div><div className="text-silver text-sm font-bold">{w.doc_number}</div><div className="text-silver/50 text-xs">{w.months ? `${w.months} ${L('شهر', 'mo')}` : ''} · {fmtD(w.start)} → {fmtD(w.end)}</div></div>
                                    {active !== null && <span className={`text-xs px-2 py-0.5 rounded ${active ? 'bg-green-500/20 text-green-300' : 'bg-silver/20 text-silver/70'}`}>{active ? L('ساري', 'Active') : L('منتهٍ', 'Expired')}</span>}
                                </button>
                            );
                        })}
                    </div>
                )}

                {tab === 'projects' && (
                    <div className="space-y-2">
                        {data.projects.length === 0 && <p className="text-silver/50 text-sm">{L('لا توجد أعمال حالية.', 'No active work.')}</p>}
                        {data.projects.map((p: any) => (
                            <div key={p.code} className={card}>
                                <div className="text-gold text-sm font-bold">{p.name}</div>
                                <div className="text-silver/60 text-xs mt-1">{L('المرحلة الحالية', 'Current stage')}: <span className="text-silver">{p.stage ? (isAr ? (STAGE_AR[p.stage] || p.stage) : p.stage) : (p.status || '—')}</span></div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'requests' && (
                    <div className="space-y-4">
                        <div className={card}>
                            <h3 className="text-gold text-sm font-bold mb-2">{L('طلب جديد / تواصل مع الدعم', 'New request / contact support')}</h3>
                            <div className="flex gap-2 mb-2 flex-wrap">
                                {(['service', 'product', 'support'] as const).map(k => (
                                    <button key={k} onClick={() => { setKind(k); setPicked(null); setItemResults([]); setItemSearch(''); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${kind === k ? 'bg-gold text-darkwhite' : 'bg-silver/10 text-silver hover:bg-silver/20'}`}>
                                        {k === 'service' ? L('طلب خدمة', 'Service') : k === 'product' ? L('طلب منتج', 'Product') : L('دعم فني', 'Support')}
                                    </button>
                                ))}
                            </div>
                            {/* pick a service/product (also used to attach the item a support ticket is about) */}
                            <div className="relative mb-2">
                                <input value={itemSearch} onChange={e => searchItems(e.target.value)} placeholder={L('اختر الخدمة/المنتج (ابحث بالاسم)', 'Pick the service/product (search)')} className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver text-sm focus:outline-none focus:border-gold" />
                                {itemResults.length > 0 && (
                                    <div className="absolute z-20 w-full mt-1 max-h-48 overflow-y-auto bg-[#2a2829] border border-gold/20 rounded-lg shadow-2xl">
                                        {itemResults.map((c: any) => (
                                            <button key={`${c.item_type}-${c.id}`} onClick={() => { setPicked(c); setItemSearch(c.name); setItemResults([]); }} className="w-full text-start px-3 py-2 hover:bg-gold/10 text-silver text-sm border-b border-white/5 last:border-0">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded me-2 ${c.item_type === 'product' ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{c.item_type === 'product' ? L('منتج', 'Product') : L('خدمة', 'Service')}</span>
                                                {c.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {picked && <p className="text-[11px] text-gold mt-1">{L('المحدَّد', 'Selected')}: {picked.name}</p>}
                            </div>
                            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder={L('الموضوع', 'Subject')} className="w-full mb-2 px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver text-sm focus:outline-none focus:border-gold" />
                            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder={L('التفاصيل (اختياري)', 'Details (optional)')} className="w-full mb-2 px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver text-sm focus:outline-none focus:border-gold" />
                            <div className="flex items-center gap-3">
                                <button onClick={submit} disabled={sending} className="px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold text-sm hover:bg-yellow-600 disabled:opacity-50">{sending ? '…' : L('إرسال', 'Send')}</button>
                                {reqMsg && <span className="text-xs text-gold">{reqMsg}</span>}
                            </div>
                        </div>
                        <div className={card}>
                            <h3 className="text-gold text-sm font-bold mb-2">{L('طلباتي السابقة', 'My requests')}</h3>
                            {data.requests.length === 0 ? <p className="text-silver/40 text-xs">{L('لا يوجد', 'None')}</p> :
                                data.requests.map((r: any) => {
                                    const st = reqStat(r.status);
                                    return (
                                        <div key={r.id} className="py-2 border-b border-silver/10 last:border-0">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-silver/80">{r.kind === 'support' ? '🛟' : r.kind === 'product' ? '📦' : '🔧'} {r.subject}{r.item_name ? ` · ${r.item_name}` : ''}</span>
                                                <span className={`px-2 py-0.5 rounded ${st.cls}`}>{L(st.ar, st.en)}</span>
                                            </div>
                                            {/* progress of the request through its lifecycle */}
                                            <div className="mt-1.5 h-1.5 bg-[#0a0a0c] rounded-full overflow-hidden">
                                                <div className="h-full bg-gold" style={{ width: `${(st.step / 7) * 100}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}

                {tab === 'profile' && (
                    <div className={card}>
                        <h3 className="text-gold text-sm font-bold mb-1">{L('تحديث بياناتي', 'Update my data')}</h3>
                        <p className="text-silver/50 text-[11px] mb-3">{L('عدّل بياناتك ثم أرسلها — لن تُطبَّق إلا بعد مراجعة موظف المبيعات/العلاقات العامة للتأكد منها.', 'Edit then submit — changes apply only after a sales/PR employee reviews and confirms them.')}</p>
                        {data.pendingUpdate && (
                            <div className="mb-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs">{L('لديك طلب تحديث قيد المراجعة.', 'You have an update request under review.')}</div>
                        )}
                        <div className="grid sm:grid-cols-2 gap-2">
                            {([['mobile', L('رقم الموبايل', 'Mobile')], ['email', L('البريد', 'Email')], ['commercial_reg_no', L('رقم السجل التجاري', 'Commercial reg. no.')], ['id_card_no', L('رقم البطاقة', 'ID card no.')]] as const).map(([k, lbl]) => (
                                <div key={k}><label className="block text-silver/70 text-xs mb-1">{lbl}</label>
                                    <input value={prof[k] || ''} onChange={e => setProf({ ...prof, [k]: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver text-sm focus:outline-none focus:border-gold" /></div>
                            ))}
                            <div className="sm:col-span-2"><label className="block text-silver/70 text-xs mb-1">{L('العنوان', 'Address')}</label>
                                <input value={prof.address || ''} onChange={e => setProf({ ...prof, address: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver text-sm focus:outline-none focus:border-gold" /></div>
                        </div>
                        <div className="mt-3 flex items-center gap-3 flex-wrap">
                            <button onClick={confirmLocation} disabled={locBusy} className="px-3 py-2 rounded-lg bg-silver/10 text-silver text-sm hover:bg-silver/20 disabled:opacity-50">📍 {locBusy ? '…' : L('تأكيد موقعي (GPS)', 'Confirm my location (GPS)')}</button>
                            {prof.lat != null && <span className="text-[11px] text-green-400">{L('الموقع', 'Location')}: {Number(prof.lat).toFixed(4)}, {Number(prof.lng).toFixed(4)}</span>}
                            <span className="text-[11px] text-silver/40">{L('يُربط موقعك بمشاريعك.', 'Your location is linked to your projects.')}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                            <button onClick={submitProfile} disabled={profBusy || !!data.pendingUpdate} className="px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold text-sm hover:bg-yellow-600 disabled:opacity-50">{profBusy ? '…' : L('إرسال للمراجعة', 'Submit for review')}</button>
                            {profMsg && <span className={`text-xs ${profMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{profMsg.text}</span>}
                        </div>
                    </div>
                )}
            </div>

            {/* Full invoice modal */}
            {openInv && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={closeDoc}>
                    <div className="bg-white text-gray-900 rounded-2xl shadow-2xl overflow-y-auto" style={{ width: 'min(92vw, 42rem)', maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b border-gray-200 no-print">
                            <h3 className="text-[#9a7a1e] font-bold">{L('فاتورة', 'Invoice')} {openInv.doc_number}</h3>
                            <div className="flex gap-2">
                                <button onClick={printDoc} className="px-3 py-1.5 rounded-lg bg-[#DBA935] text-white text-sm font-bold">🖨 {L('طباعة / PDF', 'Print / PDF')}</button>
                                <button onClick={closeDoc} className="px-2 text-gray-500 text-lg">✕</button>
                            </div>
                        </div>
                        {detailBusy && <div className="p-8 text-center text-gray-500">{L('جارٍ التحميل…', 'Loading…')}</div>}
                        {detail?.invoice && (
                            <div id="client-doc-print" className="p-6">
                                <h1 className="text-xl font-bold" style={{ color: '#9a7a1e' }}>Z.Electronic</h1>
                                <div className="text-sm text-gray-600">{L('فاتورة رقم', 'Invoice')}: {detail.invoice.doc_number} · {fmtD(detail.invoice.doc_date)}</div>
                                <div className="text-sm text-gray-600 mb-3">{L('العميل', 'Client')}: {detail.client?.name}{detail.invoice.project_id ? ` · ${L('مشروع', 'Project')}: ${detail.invoice.project_id}` : ''}</div>
                                <table>
                                    <thead><tr><th>{L('البند', 'Item')}</th><th>{L('كمية', 'Qty')}</th><th>{L('سعر', 'Price')}</th><th>{L('الإجمالي', 'Total')}</th></tr></thead>
                                    <tbody>
                                        {detail.items.map((it: any, i: number) => (
                                            <tr key={i}><td>{it.item_name}{it.item_unit ? ` (${it.item_unit})` : ''}</td><td>{Number(it.quantity).toLocaleString()}</td><td>{money(it.unit_price)}</td><td>{money(it.line_total)}</td></tr>
                                        ))}
                                        {detail.items.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#999' }}>{L('لا توجد بنود مفصّلة', 'No line items')}</td></tr>}
                                    </tbody>
                                </table>
                                <div style={{ marginTop: 10, textAlign: isAr ? 'left' : 'right' }}>
                                    {detail.invoice.subtotal != null && <div>{L('المجموع الفرعي', 'Subtotal')}: {money(detail.invoice.subtotal)}</div>}
                                    <div style={{ fontWeight: 'bold', color: '#9a7a1e', fontSize: 16 }}>{L('الإجمالي', 'Total')}: {money(detail.invoice.total)}</div>
                                    <div>{L('حالة السداد', 'Payment')}: {detail.invoice.payment_status === 'paid' ? L('مسدّدة', 'Paid') : L('غير مسدّدة', 'Unpaid')}</div>
                                </div>
                                {(detail.invoice.warranty_months || detail.invoice.warranty_end) && (
                                    <div style={{ marginTop: 12, fontSize: 12, color: '#555' }}>🛡️ {L('الضمان', 'Warranty')}: {detail.invoice.warranty_months ? `${detail.invoice.warranty_months} ${L('شهر', 'mo')} · ` : ''}{fmtD(detail.invoice.warranty_start)} → {fmtD(detail.invoice.warranty_end)}</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Full warranty certificate modal */}
            {openWar && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={closeDoc}>
                    <div className="bg-white text-gray-900 rounded-2xl shadow-2xl overflow-y-auto" style={{ width: 'min(92vw, 36rem)', maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b border-gray-200 no-print">
                            <h3 className="text-[#9a7a1e] font-bold">{L('شهادة ضمان', 'Warranty certificate')}</h3>
                            <div className="flex gap-2">
                                <button onClick={printDoc} className="px-3 py-1.5 rounded-lg bg-[#DBA935] text-white text-sm font-bold">🖨 {L('طباعة / PDF', 'Print / PDF')}</button>
                                <button onClick={closeDoc} className="px-2 text-gray-500 text-lg">✕</button>
                            </div>
                        </div>
                        <div id="client-doc-print" className="p-6 text-center">
                            <h1 className="text-2xl font-bold mb-1" style={{ color: '#9a7a1e' }}>🛡️ {L('شهادة ضمان', 'Warranty Certificate')}</h1>
                            <p className="text-gray-700 mb-4">Z.Electronic</p>
                            <div className="text-start inline-block text-sm space-y-1">
                                <div><b>{L('العميل', 'Client')}:</b> {data.client.name}</div>
                                <div><b>{L('الفاتورة', 'Invoice')}:</b> {openWar.doc_number}</div>
                                <div><b>{L('مدة الضمان', 'Duration')}:</b> {openWar.months ? `${openWar.months} ${L('شهر', 'months')}` : '—'}</div>
                                <div><b>{L('من', 'From')}:</b> {fmtD(openWar.start)} &nbsp; <b>{L('إلى', 'To')}:</b> {fmtD(openWar.end)}</div>
                                <div><b>{L('الحالة', 'Status')}:</b> {openWar.active ? L('ساري المفعول', 'Active') : L('منتهٍ', 'Expired')}</div>
                            </div>
                            {detailBusy && <p className="text-gray-400 mt-4">{L('جارٍ تحميل البنود…', 'Loading items…')}</p>}
                            {detail?.items && detail.items.length > 0 && (
                                <table style={{ marginTop: 16 }}>
                                    <thead><tr><th>{L('الصنف المشمول', 'Covered item')}</th><th>{L('كمية', 'Qty')}</th></tr></thead>
                                    <tbody>{detail.items.map((it: any, i: number) => <tr key={i}><td>{it.item_name}</td><td>{Number(it.quantity).toLocaleString()}</td></tr>)}</tbody>
                                </table>
                            )}
                            <p className="text-gray-500 text-xs mt-4">{L('يغطّي هذا الضمان عيوب التصنيع والتركيب وفق شروط الشركة خلال المدة المذكورة.', 'This warranty covers manufacturing/installation defects per company terms during the stated period.')}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
