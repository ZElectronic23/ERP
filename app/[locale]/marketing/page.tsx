'use client';

// Marketing & advertising workspace: campaigns with channel, budget vs spend, leads & conversions,
// plus a roll-up (total spend, cost-per-lead, conversion rate). Gated to the 'marketing' module.
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';

const CH: Record<string, { ar: string; en: string }> = {
    facebook: { ar: 'فيسبوك', en: 'Facebook' }, instagram: { ar: 'إنستجرام', en: 'Instagram' },
    google: { ar: 'جوجل', en: 'Google' }, whatsapp: { ar: 'واتساب', en: 'WhatsApp' },
    referral: { ar: 'توصية', en: 'Referral' }, other: { ar: 'أخرى', en: 'Other' },
};
const ST: Record<string, { ar: string; en: string; cls: string }> = {
    planned: { ar: 'مخطّطة', en: 'Planned', cls: 'bg-silver/15 text-silver' },
    active: { ar: 'نشطة', en: 'Active', cls: 'bg-green-500/20 text-green-300' },
    paused: { ar: 'متوقفة', en: 'Paused', cls: 'bg-yellow-500/20 text-yellow-300' },
    done: { ar: 'منتهية', en: 'Done', cls: 'bg-blue-500/20 text-blue-300' },
};

export default function MarketingPage() {
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [show, setShow] = useState(false);
    const empty = { name: '', channel: 'facebook', status: 'planned', budget: '', spend: '', leads: '', conversions: '', start_date: '', end_date: '', notes: '' };
    const [form, setForm] = useState<any>(empty);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true); setErr('');
        try {
            const res = await fetch('/api/marketing');
            const j = await res.json();
            if (!res.ok) { setErr(j.error || 'Error'); setData(null); return; }
            setData(j);
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const create = async () => {
        if (!form.name.trim()) return;
        setBusy(true);
        await fetch('/api/marketing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        setBusy(false); setShow(false); setForm(empty); load();
    };
    const patch = async (id: string, body: any) => {
        await fetch('/api/marketing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
        load();
    };
    const del = async (id: string) => { if (!confirm(L('حذف الحملة؟', 'Delete campaign?'))) return; await fetch(`/api/marketing?id=${id}`, { method: 'DELETE' }); load(); };

    const money = (n: any) => `${Number(n || 0).toLocaleString()} ${L('ج.م', 'EGP')}`;
    const field = 'px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver text-sm focus:outline-none focus:border-gold';
    const card = 'rounded-xl border border-silver/20 bg-[#1a1a1e] p-4';

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gold" dir={isAr ? 'rtl' : 'ltr'}>{L('جارٍ التحميل...', 'Loading...')}</div>;
    if (err || !data) return <div className="min-h-screen flex items-center justify-center text-silver p-6 text-center" dir={isAr ? 'rtl' : 'ltr'}>{err === 'Forbidden' ? L('لا تملك صلاحية التسويق.', 'You lack marketing access.') : (err || L('لا توجد بيانات', 'No data'))}</div>;

    const s = data.summary;
    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="max-w-5xl mx-auto space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-alata text-gold">{L('التسويق والدعاية', 'Marketing & advertising')}</h1>
                        <p className="text-silver/60 text-sm">{L('حملاتك عبر القنوات، ميزانياتها وإنفاقها، والعملاء المحتملين الذين جلبتهم.', 'Your campaigns across channels, their budgets & spend, and the leads they brought.')}</p>
                    </div>
                    <button onClick={() => setShow(true)} className="px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold text-sm hover:bg-yellow-600">+ {L('حملة جديدة', 'New campaign')}</button>
                </div>

                {/* summary */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className={card}><div className="text-silver/60 text-xs">{L('الميزانية', 'Budget')}</div><div className="text-xl font-bold text-gold">{money(s.budget)}</div></div>
                    <div className={card}><div className="text-silver/60 text-xs">{L('المصروف', 'Spend')}</div><div className="text-xl font-bold text-gold">{money(s.spend)}</div></div>
                    <div className={card}><div className="text-silver/60 text-xs">{L('العملاء المحتملون', 'Leads')}</div><div className="text-xl font-bold text-gold">{s.leads}</div></div>
                    <div className={card}><div className="text-silver/60 text-xs">{L('تكلفة العميل المحتمل', 'Cost/lead')}</div><div className="text-xl font-bold text-gold">{s.costPerLead != null ? money(s.costPerLead) : '—'}</div></div>
                    <div className={card}><div className="text-silver/60 text-xs">{L('معدّل التحويل', 'Conv. rate')}</div><div className="text-xl font-bold text-gold">{s.convRate != null ? `${s.convRate}%` : '—'}</div></div>
                </div>

                {data.campaigns.length === 0 && <p className="text-silver/50 text-sm">{L('لا توجد حملات بعد — أضف أول حملة.', 'No campaigns yet — add your first.')}</p>}
                <div className="space-y-2">
                    {data.campaigns.map((c: any) => (
                        <div key={c.id} className={card}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="text-silver text-sm font-bold">{c.name} <span className="text-silver/40 text-xs">· {CH[c.channel] ? (isAr ? CH[c.channel].ar : CH[c.channel].en) : c.channel}</span></div>
                                <div className="flex items-center gap-2">
                                    <select value={c.status} onChange={e => patch(c.id, { status: e.target.value })} className={`${field} py-1 text-xs`}>
                                        {data.statuses.map((x: string) => <option key={x} value={x}>{ST[x] ? (isAr ? ST[x].ar : ST[x].en) : x}</option>)}
                                    </select>
                                    <button onClick={() => del(c.id)} className="text-red-400 hover:text-red-300 text-xs">{L('حذف', 'Delete')}</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs">
                                <label className="text-silver/50">{L('الميزانية', 'Budget')}<input type="number" defaultValue={c.budget} onBlur={e => patch(c.id, { budget: e.target.value })} className={`${field} w-full mt-0.5`} /></label>
                                <label className="text-silver/50">{L('المصروف', 'Spend')}<input type="number" defaultValue={c.spend} onBlur={e => patch(c.id, { spend: e.target.value })} className={`${field} w-full mt-0.5`} /></label>
                                <label className="text-silver/50">{L('محتملون', 'Leads')}<input type="number" defaultValue={c.leads} onBlur={e => patch(c.id, { leads: e.target.value })} className={`${field} w-full mt-0.5`} /></label>
                                <label className="text-silver/50">{L('تحويلات', 'Conversions')}<input type="number" defaultValue={c.conversions} onBlur={e => patch(c.id, { conversions: e.target.value })} className={`${field} w-full mt-0.5`} /></label>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShow(false)}>
                    <div className="bg-[#1a1a1e]/95 rounded-2xl border border-gold/30 p-6 shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
                        <h3 className="text-gold font-alata mb-3">{L('حملة جديدة', 'New campaign')}</h3>
                        <div className="space-y-2">
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={L('اسم الحملة', 'Campaign name')} className={`${field} w-full`} />
                            <div className="grid grid-cols-2 gap-2">
                                <select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} className={`${field} w-full`}>{data.channels.map((x: string) => <option key={x} value={x}>{CH[x] ? (isAr ? CH[x].ar : CH[x].en) : x}</option>)}</select>
                                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={`${field} w-full`}>{data.statuses.map((x: string) => <option key={x} value={x}>{ST[x] ? (isAr ? ST[x].ar : ST[x].en) : x}</option>)}</select>
                                <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} placeholder={L('الميزانية', 'Budget')} className={`${field} w-full`} />
                                <input type="number" value={form.spend} onChange={e => setForm({ ...form, spend: e.target.value })} placeholder={L('المصروف', 'Spend')} className={`${field} w-full`} />
                                <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className={`${field} w-full`} />
                                <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className={`${field} w-full`} />
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
