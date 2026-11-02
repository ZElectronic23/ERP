'use client';

// Tech-support / CRM admin workspace. Here the support/sales/PR team handles client tickets
// (move them through the lifecycle), reviews & approves client data-update requests (applied to
// the client record only on approval), and works the follow-up list. Gated to the 'support' module.
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';

type Tab = 'tickets' | 'updates' | 'followups';

const STATUS: Record<string, { ar: string; en: string }> = {
    submitted: { ar: 'قيد المراجعة', en: 'Submitted' }, planning: { ar: 'يُخطَّط كمشروع', en: 'Planning' },
    survey: { ar: 'في المعاينة', en: 'Survey' }, waiting: { ar: 'في الانتظار', en: 'Waiting' },
    support_received: { ar: 'استقبله الدعم', en: 'Received' }, in_progress: { ar: 'جارٍ العمل', en: 'In progress' },
    closed: { ar: 'مكتمل', en: 'Closed' }, open: { ar: 'مفتوح', en: 'Open' },
};

export default function SupportPage() {
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [tab, setTab] = useState<Tab>('tickets');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [msg, setMsg] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setErr('');
        try {
            const res = await fetch('/api/support');
            const j = await res.json();
            if (!res.ok) { setErr(j.error || 'Error'); setData(null); return; }
            setData(j);
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const setTicketStatus = async (id: string, status: string) => {
        await fetch('/api/support', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'ticket', id, status }) });
        load();
    };
    const decideUpdate = async (id: string, decision: 'approved' | 'rejected') => {
        setMsg('');
        const res = await fetch('/api/support', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'update', id, decision }) });
        const j = await res.json().catch(() => ({}));
        if (res.ok) setMsg(decision === 'approved' ? L('تم الاعتماد وتطبيق التعديلات ✓', 'Approved & applied ✓') : L('تم الرفض', 'Rejected'));
        else setMsg(j.error || 'Error');
        load();
    };
    const markFollowed = async (client_id: string) => {
        await fetch('/api/support', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'followup', client_id }) });
        load();
    };

    const fmtD = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : '—');
    const card = 'rounded-xl border border-silver/20 bg-[#1a1a1e] p-4';
    const fieldLbl: Record<string, string> = { mobile: L('الموبايل', 'Mobile'), email: L('البريد', 'Email'), address: L('العنوان', 'Address'), commercial_reg_no: L('السجل التجاري', 'Commercial reg.'), id_card_no: L('البطاقة', 'ID card'), lat: L('خط العرض', 'Lat'), lng: L('خط الطول', 'Lng') };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gold" dir={isAr ? 'rtl' : 'ltr'}>{L('جارٍ التحميل...', 'Loading...')}</div>;
    if (err || !data) return <div className="min-h-screen flex items-center justify-center text-silver p-6 text-center" dir={isAr ? 'rtl' : 'ltr'}>{err === 'Forbidden' ? L('لا تملك صلاحية الدعم/العلاقات.', 'You lack support access.') : (err || L('لا توجد بيانات', 'No data'))}</div>;

    const pendingUpdates = data.updates.filter((u: any) => u.status === 'pending').length;
    const openTickets = data.tickets.filter((t: any) => t.status !== 'closed').length;
    const TABS: [Tab, string, number][] = [
        ['tickets', L('تذاكر العملاء', 'Tickets'), openTickets],
        ['updates', L('طلبات تحديث البيانات', 'Data updates'), pendingUpdates],
        ['followups', L('متابعة العملاء', 'Follow-ups'), data.followUps.length],
    ];

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="max-w-4xl mx-auto space-y-5">
                <div>
                    <h1 className="text-2xl font-alata text-gold">{L('الدعم الفني وعلاقات العملاء', 'Support & CRM')}</h1>
                    <p className="text-silver/60 text-sm">{L('استقبل تذاكر العملاء وحرّك حالاتها، راجع واعتمد طلبات تحديث بياناتهم، وتابع المستحقّ متابعتهم.', 'Handle client tickets, review & approve their data updates, and work the follow-up list.')}</p>
                </div>

                <div className="flex gap-2 flex-wrap">
                    {TABS.map(([k, lbl, n]) => (
                        <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${tab === k ? 'bg-gold text-darkwhite' : 'bg-silver/10 text-silver hover:bg-silver/20'}`}>
                            {lbl}{n > 0 && <span className="ms-1 px-1.5 rounded-full bg-red-500 text-white text-[10px]">{n}</span>}
                        </button>
                    ))}
                </div>
                {msg && <div className="p-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-300 text-sm">{msg}</div>}

                {tab === 'tickets' && (
                    <div className="space-y-2">
                        {data.tickets.length === 0 && <p className="text-silver/50 text-sm">{L('لا توجد تذاكر.', 'No tickets.')}</p>}
                        {data.tickets.map((t: any) => (
                            <div key={t.id} className={`${card} flex items-center justify-between gap-3 flex-wrap`}>
                                <div>
                                    <div className="text-silver text-sm font-bold">{t.kind === 'support' ? '🛟' : t.kind === 'product' ? '📦' : '🔧'} {t.subject}</div>
                                    <div className="text-silver/50 text-xs mt-0.5">{t.client_name}{t.item_name ? ` · ${t.item_name}` : ''} · {fmtD(t.created_at)}</div>
                                    {t.description && <div className="text-silver/40 text-xs mt-0.5">{t.description}</div>}
                                </div>
                                <select value={t.status} onChange={e => setTicketStatus(t.id, e.target.value)} className="px-2 py-1 bg-[#0a0a0c] border border-silver/30 rounded text-silver text-xs focus:outline-none focus:border-gold">
                                    {data.statuses.map((s: string) => <option key={s} value={s}>{STATUS[s] ? (isAr ? STATUS[s].ar : STATUS[s].en) : s}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'updates' && (
                    <div className="space-y-2">
                        {data.updates.length === 0 && <p className="text-silver/50 text-sm">{L('لا توجد طلبات تحديث.', 'No update requests.')}</p>}
                        {data.updates.map((u: any) => (
                            <div key={u.id} className={card}>
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="text-gold text-sm font-bold">{u.client_name}</div>
                                    <span className={`text-xs px-2 py-0.5 rounded ${u.status === 'approved' ? 'bg-green-500/20 text-green-300' : u.status === 'rejected' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{u.status === 'approved' ? L('معتمد', 'Approved') : u.status === 'rejected' ? L('مرفوض', 'Rejected') : L('قيد المراجعة', 'Pending')}</span>
                                </div>
                                <div className="mt-2 text-xs text-silver/80 space-y-0.5">
                                    {Object.entries(u.changes || {}).map(([k, v]: any) => (
                                        <div key={k}><span className="text-silver/50">{fieldLbl[k] || k}:</span> {String(v)}</div>
                                    ))}
                                </div>
                                {u.status === 'pending' && (
                                    <div className="mt-3 flex gap-2">
                                        <button onClick={() => decideUpdate(u.id, 'approved')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-500">{L('اعتماد وتطبيق', 'Approve & apply')}</button>
                                        <button onClick={() => decideUpdate(u.id, 'rejected')} className="px-3 py-1.5 bg-red-600/80 text-white rounded-lg text-xs font-bold hover:bg-red-600">{L('رفض', 'Reject')}</button>
                                        <span className="text-silver/40 text-[11px] self-center">{L('التحقق من العميل قبل الاعتماد.', 'Verify the client before approving.')}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'followups' && (
                    <div className="space-y-2">
                        {data.followUps.length === 0 && <p className="text-silver/50 text-sm">{L('لا يوجد عملاء مستحقّ متابعتهم اليوم. 🎉', 'No clients due for follow-up. 🎉')}</p>}
                        {data.followUps.map((c: any) => (
                            <div key={c.ClientId} className={`${card} flex items-center justify-between gap-3 flex-wrap`}>
                                <div>
                                    <div className="text-silver text-sm font-bold">{c.ClientName}</div>
                                    <div className="text-silver/50 text-xs mt-0.5">{c['Mobile No.'] || c['E-Mail'] || ''} · {L('المتابعة التالية', 'Next')}: {fmtD(c.NextFollowUpDate)}</div>
                                </div>
                                <button onClick={() => markFollowed(c.ClientId)} className="px-3 py-1.5 bg-gold/20 text-gold rounded-lg text-xs hover:bg-gold/30">{L('تمّت المتابعة', 'Mark followed')}</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
