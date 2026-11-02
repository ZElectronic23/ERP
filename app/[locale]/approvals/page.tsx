'use client';

// Central approvals inbox — one place where any staff member sees the approvals waiting on
// them (1-click approve / reject-with-mandatory-reason) and tracks their own requests with
// full step history. Every decision is sent to PATCH /api/approvals, which re-enforces role,
// sequence, self-approval and audit rules on the server.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

interface Assigned {
    id: string; entity_type: string; entity_id: string; title: string;
    required_role: string | null; requested_by_name: string | null;
    step_order: number; total_steps: number;
}
interface MineStep { title: string; status: string; approver_name: string | null; note: string | null; acted_at: string | null; }
interface Mine { entity_type: string; entity_id: string; cycle: number; status: string; current_step: string | null; steps: MineStep[]; }

const ENTITY_LABEL: Record<string, { ar: string; en: string }> = {
    document: { ar: 'مستند', en: 'Document' },
    contract: { ar: 'عقد', en: 'Contract' },
    project: { ar: 'مشروع', en: 'Project' },
    leave: { ar: 'طلب إجازة', en: 'Leave' },
    procurement: { ar: 'مشتريات', en: 'Procurement' },
    expense: { ar: 'مصروف', en: 'Expense' },
    survey_gate: { ar: 'بوابة مسح فني', en: 'Survey gate' },
};
const STATUS: Record<string, { ar: string; en: string; cls: string }> = {
    approved: { ar: 'معتمد', en: 'Approved', cls: 'bg-green-500/20 text-green-300' },
    rejected: { ar: 'مرفوض', en: 'Rejected', cls: 'bg-red-500/20 text-red-300' },
    in_review: { ar: 'قيد المراجعة', en: 'In review', cls: 'bg-yellow-500/20 text-yellow-300' },
    draft: { ar: 'مسودة', en: 'Draft', cls: 'bg-silver/20 text-silver' },
    pending: { ar: 'بالانتظار', en: 'Pending', cls: 'bg-yellow-500/20 text-yellow-300' },
};

export default function ApprovalsPage() {
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [tab, setTab] = useState<'assigned' | 'mine'>('assigned');
    const [assigned, setAssigned] = useState<Assigned[]>([]);
    const [mine, setMine] = useState<Mine[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [msg, setMsg] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [rejecting, setRejecting] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);
    const router = useRouter();

    // Where to open the actual entity so the approver can review it before deciding.
    // Returns null when the module has no per-record page to deep-link to.
    const entityHref = (entityType: string, entityId: string): string | null => {
        switch (entityType) {
            case 'document': return `/${locale}/documents/${entityId}`;
            case 'project': return `/${locale}/projects/${entityId}`;
            case 'survey_gate': return `/${locale}/surveys`;
            case 'contract': return `/${locale}/legal`;
            case 'expense': return `/${locale}/accounting`;
            case 'leave': return `/${locale}/hr`;
            default: return null;
        }
    };

    const load = useCallback(async () => {
        setLoading(true); setErr('');
        try {
            const res = await fetch('/api/approvals/inbox');
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            setAssigned(j.assigned || []);
            setMine(j.mine || []);
        } catch (e: any) { setErr(e.message); }
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const decide = async (id: string, decision: 'approved' | 'rejected', why?: string) => {
        setBusyId(id); setErr(''); setMsg('');
        try {
            const res = await fetch('/api/approvals', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, decision, reason: why || null }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            setMsg(decision === 'approved' ? L('تم الاعتماد ✓', 'Approved ✓') : L('تم الرفض', 'Rejected'));
            setRejecting(null); setReason('');
            await load();
        } catch (e: any) { setErr(e.message); }
        setBusyId(null);
    };

    const label = (t: string) => { const e = ENTITY_LABEL[t]; return e ? L(e.ar, e.en) : t; };
    const stat = (s: string) => { const v = STATUS[s] || STATUS.draft; return v; };

    return (
        <div className="p-6 max-w-4xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
            <h1 className="text-2xl font-alata text-gold mb-1">{L('الاعتمادات', 'Approvals')}</h1>
            <p className="text-silver/60 text-sm mb-5">{L('اعتمد الطلبات الموكلة إليك وتابع حالة طلباتك.', 'Decide the requests assigned to you and track your own.')}</p>

            <div className="flex gap-2 mb-5">
                <button onClick={() => setTab('assigned')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${tab === 'assigned' ? 'bg-gold text-darkwhite' : 'bg-silver/10 text-silver hover:bg-silver/20'}`}>
                    {L('وارد الاعتمادات', 'Assigned to me')} {assigned.length > 0 && <span className="ms-1 px-1.5 rounded-full bg-red-500 text-white text-[10px]">{assigned.length}</span>}
                </button>
                <button onClick={() => setTab('mine')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${tab === 'mine' ? 'bg-gold text-darkwhite' : 'bg-silver/10 text-silver hover:bg-silver/20'}`}>
                    {L('طلباتي', 'My requests')} <span className="ms-1 text-silver/50">({mine.length})</span>
                </button>
            </div>

            {msg && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-300 text-sm">{msg}</div>}
            {err && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{err}</div>}
            {loading && <p className="text-silver/50 text-sm">{L('جارِ التحميل…', 'Loading…')}</p>}

            {!loading && tab === 'assigned' && (
                assigned.length === 0
                    ? <p className="text-silver/50 text-sm">{L('لا توجد اعتمادات بانتظارك. 🎉', 'Nothing waiting on you. 🎉')}</p>
                    : <div className="space-y-3">
                        {assigned.map(a => {
                            const href = entityHref(a.entity_type, a.entity_id);
                            const isOpen = expanded === a.id;
                            return (
                            <div key={a.id} className="rounded-xl border border-silver/20 bg-[#1a1a1e] p-4">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div>
                                        <button onClick={() => setExpanded(isOpen ? null : a.id)} className="text-gold text-sm font-bold hover:underline flex items-center gap-1">
                                            <span className="text-silver/40 text-xs">{isOpen ? '▼' : '▶'}</span>
                                            {label(a.entity_type)} · <span className="text-silver">{a.entity_id}</span>
                                        </button>
                                        <div className="text-silver/80 text-sm mt-1">{L('الخطوة', 'Step')}: {a.title} <span className="text-silver/40">({a.step_order}/{a.total_steps})</span></div>
                                        <div className="text-silver/50 text-xs mt-1">
                                            {L('مقدّم الطلب', 'Requested by')}: {a.requested_by_name || '—'}
                                            {a.required_role && <> · {L('الصلاحية المطلوبة', 'Required role')}: {a.required_role}</>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button disabled={busyId === a.id} onClick={() => decide(a.id, 'approved')}
                                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-500 disabled:opacity-50">
                                            {L('اعتماد', 'Approve')}
                                        </button>
                                        <button disabled={busyId === a.id} onClick={() => { setRejecting(rejecting === a.id ? null : a.id); setReason(''); }}
                                            className="px-3 py-1.5 bg-red-600/80 text-white rounded-lg text-sm font-bold hover:bg-red-600 disabled:opacity-50">
                                            {L('رفض', 'Reject')}
                                        </button>
                                    </div>
                                </div>
                                {isOpen && (
                                    <div className="mt-3 rounded-lg bg-black/30 border border-silver/15 p-3 text-xs text-silver/80 space-y-1">
                                        <div><span className="text-silver/50">{L('النوع', 'Type')}:</span> {label(a.entity_type)}</div>
                                        <div><span className="text-silver/50">{L('رقم/كود العنصر', 'Item ref')}:</span> {a.entity_id}</div>
                                        <div><span className="text-silver/50">{L('الخطوة الحالية', 'Current step')}:</span> {a.title} ({a.step_order}/{a.total_steps})</div>
                                        <div><span className="text-silver/50">{L('مقدّم الطلب', 'Requested by')}:</span> {a.requested_by_name || '—'}</div>
                                        <div className="pt-2">
                                            {href
                                                ? <button onClick={() => router.push(href)} className="px-3 py-1.5 bg-gold text-darkwhite rounded-lg text-xs font-bold hover:bg-yellow-600">{L('فتح العنصر للمراجعة ←', 'Open item to review →')}</button>
                                                : <span className="text-silver/40">{L('هذا النوع لا يملك صفحة تفصيلية للفتح.', 'This type has no detail page to open.')}</span>}
                                            <span className="text-silver/40 ms-2">{L('راجع التفاصيل قبل الاعتماد.', 'Review the details before approving.')}</span>
                                        </div>
                                    </div>
                                )}
                                {rejecting === a.id && (
                                    <div className="mt-3 flex gap-2">
                                        <input value={reason} onChange={e => setReason(e.target.value)} autoFocus
                                            placeholder={L('سبب الرفض (مطلوب)', 'Rejection reason (required)')}
                                            className="flex-1 px-3 py-2 bg-[#0a0a0c] border border-red-500/40 rounded-lg text-silver text-sm focus:outline-none focus:border-red-500" />
                                        <button disabled={busyId === a.id || !reason.trim()} onClick={() => decide(a.id, 'rejected', reason.trim())}
                                            className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-500 disabled:opacity-50">
                                            {L('تأكيد الرفض', 'Confirm reject')}
                                        </button>
                                    </div>
                                )}
                            </div>
                            );
                        })}
                    </div>
            )}

            {!loading && tab === 'mine' && (
                mine.length === 0
                    ? <p className="text-silver/50 text-sm">{L('لم تبدأ أي طلب اعتماد بعد.', 'You have no approval requests yet.')}</p>
                    : <div className="space-y-3">
                        {mine.map((m, i) => {
                            const s = stat(m.status);
                            return (
                                <div key={i} className="rounded-xl border border-silver/20 bg-[#1a1a1e] p-4">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="text-gold text-sm font-bold">{label(m.entity_type)} · <span className="text-silver">{m.entity_id}</span></div>
                                        <span className={`px-2 py-0.5 rounded text-xs ${s.cls}`}>{L(s.ar, s.en)}</span>
                                    </div>
                                    {m.current_step && m.status === 'in_review' && (
                                        <div className="text-silver/60 text-xs mt-1">{L('الخطوة الحالية', 'Current step')}: {m.current_step}</div>
                                    )}
                                    <div className="mt-3 space-y-1">
                                        {m.steps.map((st, j) => {
                                            const ss = stat(st.status);
                                            return (
                                                <div key={j} className="flex items-center gap-2 text-xs">
                                                    <span className={`px-1.5 py-0.5 rounded ${ss.cls}`}>{L(ss.ar, ss.en)}</span>
                                                    <span className="text-silver/80">{st.title}</span>
                                                    {st.approver_name && <span className="text-silver/40">— {st.approver_name}</span>}
                                                    {st.note && <span className="text-red-400/80">· {st.note}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
            )}
        </div>
    );
}
