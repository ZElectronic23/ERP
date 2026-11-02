'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

type EntityType = 'document' | 'contract' | 'project' | 'leave' | 'procurement' | 'expense' | 'survey_gate';

interface Step {
    id: string;
    step_order: number;
    title: string;
    status: 'pending' | 'approved' | 'rejected';
    approver_name: string | null;
    approver_position: string | null;
    note: string | null;
    acted_at: string | null;
    requested_by_name: string | null;
}

interface Props {
    entityType: EntityType;
    entityId: string;
    locale: string;
    value?: number;   // drives value-based route selection on cycle start
    onStatusChange?: (status: string) => void;
}

export default function ApprovalPanel({ entityType, entityId, locale, value, onStatusChange }: Props) {
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [steps, setSteps] = useState<Step[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [reasonFor, setReasonFor] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from('approvals').select('*')
            .eq('entity_type', entityType).eq('entity_id', entityId).order('step_order');
        setSteps((data as Step[]) || []);
        setLoading(false);
    }, [entityType, entityId]);

    useEffect(() => { load(); }, [load]);

    const overall = (rows: Step[]): string => {
        if (rows.length === 0) return 'draft';
        if (rows.some(s => s.status === 'rejected')) return 'rejected';
        if (rows.every(s => s.status === 'approved')) return 'approved';
        return 'in_review';
    };

    const startCycle = async () => {
        setBusy(true); setErr('');
        const res = await fetch('/api/approvals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityType, entityId, value }) });
        const j = await res.json();
        setBusy(false);
        if (!res.ok) { setErr(j.error || 'Error'); return; }
        onStatusChange?.('in_review');
        load();
    };

    const act = async (step: Step, decision: 'approved' | 'rejected') => {
        const reason = (reasonFor[step.id] || '').trim();
        if (decision === 'rejected' && !reason) { setErr(L('سبب الرفض مطلوب', 'Rejection reason is required')); return; }
        setBusy(true); setErr('');
        const res = await fetch('/api/approvals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: step.id, decision, reason }) });
        const j = await res.json();
        setBusy(false);
        if (!res.ok) { setErr(j.error || 'Error'); return; }
        onStatusChange?.(j.status);
        load();
    };

    const badge = (s: string) => {
        const m: Record<string, { ar: string; en: string; cls: string }> = {
            pending: { ar: 'قيد الانتظار', en: 'Pending', cls: 'bg-gray-500/20 text-gray-300' },
            approved: { ar: 'معتمد', en: 'Approved', cls: 'bg-green-500/20 text-green-400' },
            rejected: { ar: 'مرفوض', en: 'Rejected', cls: 'bg-red-500/20 text-red-400' },
            in_review: { ar: 'قيد المراجعة', en: 'In review', cls: 'bg-yellow-500/20 text-yellow-400' },
            draft: { ar: 'مسودة', en: 'Draft', cls: 'bg-gray-500/20 text-gray-300' },
        };
        const v = m[s] || m.draft;
        return <span className={`px-2 py-0.5 rounded-full text-xs ${v.cls}`}>{isAr ? v.ar : v.en}</span>;
    };

    const activeStepId = steps.find(s => s.status === 'pending')?.id;
    const fmtTime = (t: string | null) => t ? new Date(t).toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }) : '';

    if (loading) return <div className="text-silver text-sm">{L('جارٍ التحميل...', 'Loading...')}</div>;

    return (
        <div className="bg-black/30 rounded-xl border border-gold/20 p-4 print:border-gray-300">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-gold font-semibold">{L('دورة الاعتماد المستندية', 'Approval cycle')}</h3>
                {steps.length > 0 && <span className="print:hidden">{badge(overall(steps))}</span>}
            </div>

            {err && <div className="mb-3 text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 print:hidden">{err}</div>}

            {steps.length === 0 ? (
                <div className="text-center py-4">
                    <p className="text-silver text-sm mb-3">{L('لم تبدأ دورة الاعتماد بعد', 'Approval cycle not started')}</p>
                    <button onClick={startCycle} disabled={busy} className="px-4 py-2 rounded-lg bg-gold text-darkwhite font-bold text-sm hover:bg-yellow-600 disabled:opacity-50 print:hidden">{L('بدء دورة الاعتماد', 'Start approval cycle')}</button>
                </div>
            ) : (
                <div className="space-y-2">
                    {steps[0]?.requested_by_name && <p className="text-silver/60 text-[11px]">{L('مُقدّم الطلب', 'Requested by')}: {steps[0].requested_by_name}</p>}
                    {steps.map(s => (
                        <div key={s.id} className="border border-silver/15 rounded-lg p-3">
                            <div className="flex justify-between items-center gap-2">
                                <span className="text-white text-sm font-medium">{s.step_order}. {s.title}</span>
                                {badge(s.status)}
                            </div>
                            {s.acted_at && (
                                <p className="text-silver/70 text-xs mt-1">
                                    {s.status === 'approved' ? L('اعتمد', 'Approved by') : L('رفض', 'Rejected by')}: {s.approver_name}
                                    {s.approver_position ? ` (${s.approver_position})` : ''} — {fmtTime(s.acted_at)}
                                </p>
                            )}
                            {s.note && <p className={`text-xs mt-1 ${s.status === 'rejected' ? 'text-red-300' : 'text-silver/80'}`}>📝 {s.status === 'rejected' ? L('سبب الرفض: ', 'Reason: ') : ''}{s.note}</p>}

                            {s.id === activeStepId && (
                                <div className="mt-2 print:hidden">
                                    <input value={reasonFor[s.id] || ''} onChange={e => setReasonFor({ ...reasonFor, [s.id]: e.target.value })}
                                        placeholder={L('ملاحظة / سبب الرفض (إلزامي عند الرفض)', 'Note / rejection reason (required to reject)')}
                                        className="w-full mb-2 px-3 py-1.5 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white text-xs focus:outline-none focus:border-gold" />
                                    <div className="flex gap-2">
                                        <button onClick={() => act(s, 'approved')} disabled={busy} className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-50">{L('اعتماد', 'Approve')}</button>
                                        <button onClick={() => act(s, 'rejected')} disabled={busy || !(reasonFor[s.id] || '').trim()} title={!(reasonFor[s.id] || '').trim() ? L('اكتب سبب الرفض أولاً', 'Enter a reason first') : ''} className="px-4 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 disabled:opacity-40">{L('رفض', 'Reject')}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    <p className="text-silver/40 text-[10px] mt-1 print:hidden">{L('كل قرار مُسجَّل بهوية المُعتمِد والوقت في سجل التدقيق ولا يمكن تعديله.', 'Each decision is recorded with the approver identity and time in the audit log and cannot be altered.')}</p>
                </div>
            )}
        </div>
    );
}
