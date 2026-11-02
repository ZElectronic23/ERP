'use client';

import { useState, useEffect, useCallback } from 'react';
import ApprovalPanel from '@/components/ApprovalPanel';
import {
    DIMENSIONS, LIKELIHOOD_LABEL, IMPACT_LABEL, LEVEL_LABEL, GATE_LABEL,
    type Likelihood, type Impact, type Level,
} from '@/lib/survey/risk';

interface Risk {
    id: string; dimension: string; applicable: boolean; likelihood: string | null; impact: string | null; level: string | null;
    basis: string | null; evidence: string | null; mitigation: string | null; owner: string | null; residual: string | null;
    status: string; requires_approval: boolean; source: string;
}
interface Gate {
    id: string; gate_type: string; reason: string | null; required_role: string | null; approval_status: string;
    waived: boolean; waived_reason: string | null; waived_by_name: string | null; satisfied: boolean; rejected: boolean; blocking: boolean;
}

export default function RiskGates({ surveyId, locale = 'ar' }: { surveyId: string; locale?: string }) {
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);
    const [risks, setRisks] = useState<Risk[]>([]);
    const [gates, setGates] = useState<Gate[]>([]);
    const [clearance, setClearance] = useState<{ blocking: number; cleared: boolean }>({ blocking: 0, cleared: true });
    const [canManage, setCanManage] = useState(false);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [msg, setMsg] = useState('');

    const field = 'bg-black/30 border border-[#DBA935]/20 rounded-lg px-2 py-1 text-xs text-white focus:border-[#DBA935]/60 outline-none';
    const dimLabel = (k: string) => { const d = DIMENSIONS.find(x => x.key === k); return d ? (isAr ? d.ar : d.en) : k; };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [r, g] = await Promise.all([fetch(`/api/surveys/${surveyId}/risks`), fetch(`/api/surveys/${surveyId}/gates`)]);
            const rj = await r.json(); const gj = await g.json();
            if (!r.ok) throw new Error(rj.error || 'Error'); if (!g.ok) throw new Error(gj.error || 'Error');
            setRisks(rj.risks || []); setGates(gj.gates || []); setClearance(gj.clearance); setCanManage(!!gj.canManage);
        } catch (e: any) { setErr(e.message); }
        setLoading(false);
    }, [surveyId]);

    useEffect(() => { load(); }, [load]);

    const postRisk = async (body: any) => { const res = await fetch(`/api/surveys/${surveyId}/risks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await res.json(); if (!res.ok) { setErr(j.error || 'Error'); return; } setRisks(j.risks || []); setErr(''); };
    const postGate = async (body: any) => { const res = await fetch(`/api/surveys/${surveyId}/gates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await res.json(); if (!res.ok) { setErr(j.error || 'Error'); return; } if (j.gates) { setGates(j.gates); setClearance(j.clearance); } setErr(''); };

    const clearSurvey = async () => {
        setErr(''); setMsg('');
        const res = await fetch(`/api/surveys/${surveyId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved' }) });
        const j = await res.json();
        if (!res.ok) { setErr(j.error || 'Error'); return; }
        setMsg(L('تم اعتماد جاهزية المسح ✓', 'Survey cleared ✓'));
    };

    const gateState = (g: Gate) => g.waived ? L('مُعفى', 'Waived') : g.satisfied ? L('مُعتمد', 'Approved') : g.rejected ? L('مرفوض', 'Rejected') : g.approval_status === 'in_review' ? L('قيد الاعتماد', 'In review') : L('مفتوح', 'Open');
    const gateCls = (g: Gate) => g.satisfied ? 'bg-green-500/20 text-green-300' : g.rejected ? 'bg-red-500/20 text-red-300' : g.approval_status === 'in_review' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-orange-500/20 text-orange-300';

    return (
        <div className="bg-black/40 backdrop-blur-sm p-4 md:p-5 rounded-3xl border border-[#DBA935]/20 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                    <h2 className="text-[#DBA935] font-bold">{L('تقييم المخاطر وبوابات الاعتماد', 'Risk assessment & approval gates')}</h2>
                    <p className="text-[#C0C0C0] text-xs">{L('تصنيف كيفي مبني على الأدلة — بدون احتمالات مُختلقة. الإجراءات الحرجة لا تُنفّذ دون اعتماد.', 'Evidence-based qualitative rating — no invented probabilities. Critical actions need approval.')}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => postRisk({ action: 'generate' })} className="px-3 py-1.5 rounded-lg bg-[#DBA935]/20 text-[#DBA935] text-xs font-bold hover:bg-[#DBA935]/30">{risks.length ? L('↻ تحديث المخاطر', '↻ Refresh risks') : L('⚙ توليد المخاطر', '⚙ Generate risks')}</button>
                    <button onClick={() => postGate({ action: 'generate' })} className="px-3 py-1.5 rounded-lg bg-[#DBA935]/20 text-[#DBA935] text-xs font-bold hover:bg-[#DBA935]/30">{gates.length ? L('↻ تحديث البوابات', '↻ Refresh gates') : L('⚙ توليد البوابات', '⚙ Generate gates')}</button>
                </div>
            </div>
            <p className="text-[11px] text-[#C0C0C0]/60">{L('التوليد يعتمد على آخر نسخة محفوظة — احفظ المسح أولاً.', 'Generation uses the last saved version — save the survey first.')}</p>
            {err && <div className="text-red-400 text-sm">{err}</div>}
            {msg && <div className="text-green-400 text-sm">{msg}</div>}

            {loading ? <div className="text-center py-6 text-[#C0C0C0] text-sm">{L('جارٍ التحميل...', 'Loading...')}</div> : (<>
                {/* risk register */}
                <div>
                    <h3 className="text-[#C0C0C0] text-xs font-bold mb-2">{L('سجل المخاطر', 'Risk register')}</h3>
                    {risks.length === 0 ? <p className="text-[#C0C0C0]/60 text-sm">{L('اضغط «توليد المخاطر» بعد حفظ المسح.', 'Click "Generate risks" after saving.')}</p> : (
                        <div className="space-y-2">
                            {risks.map(r => {
                                const lvl = (r.level || 'low') as Level; const lc = LEVEL_LABEL[lvl];
                                return (
                                    <div key={r.id} className="bg-black/20 rounded-lg p-2">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className="text-white text-sm font-bold flex-1 min-w-[150px]">{dimLabel(r.dimension)}</span>
                                            {r.level && <span className={`text-[10px] px-2 py-0.5 rounded-full ${lc.cls}`}>{isAr ? lc.ar : lc.en}</span>}
                                            {r.requires_approval && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">{L('يتطلب اعتماد', 'needs approval')}</span>}
                                            <button onClick={() => postRisk({ action: 'delete', riskId: r.id })} className="text-red-400 text-xs hover:text-red-300">{L('حذف', 'Remove')}</button>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                                            <select value={r.likelihood || ''} onChange={e => postRisk({ action: 'update', riskId: r.id, likelihood: e.target.value })} className={field}>
                                                <option value="">{L('الاحتمال', 'Likelihood')}</option>
                                                {(['rare', 'possible', 'likely'] as Likelihood[]).map(k => <option key={k} value={k}>{isAr ? LIKELIHOOD_LABEL[k].ar : LIKELIHOOD_LABEL[k].en}</option>)}
                                            </select>
                                            <select value={r.impact || ''} onChange={e => postRisk({ action: 'update', riskId: r.id, impact: e.target.value })} className={field}>
                                                <option value="">{L('الأثر', 'Impact')}</option>
                                                {(['low', 'medium', 'high', 'critical'] as Impact[]).map(k => <option key={k} value={k}>{isAr ? IMPACT_LABEL[k].ar : IMPACT_LABEL[k].en}</option>)}
                                            </select>
                                            <input placeholder={L('المسؤول', 'Owner')} defaultValue={r.owner || ''} onBlur={e => e.target.value !== (r.owner || '') && postRisk({ action: 'update', riskId: r.id, owner: e.target.value })} className={field} />
                                            <select value={r.status} onChange={e => postRisk({ action: 'update', riskId: r.id, status: e.target.value })} className={field}>
                                                <option value="open">{L('مفتوح', 'Open')}</option>
                                                <option value="mitigated">{L('تم التخفيف', 'Mitigated')}</option>
                                                <option value="accepted">{L('مقبول', 'Accepted')}</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <textarea placeholder={L('الأساس (لماذا هذا التقييم) *', 'Basis (why this rating) *')} defaultValue={r.basis || ''} onBlur={e => e.target.value !== (r.basis || '') && postRisk({ action: 'update', riskId: r.id, basis: e.target.value })} rows={2} className={field} />
                                            <textarea placeholder={L('التخفيف', 'Mitigation')} defaultValue={r.mitigation || ''} onBlur={e => e.target.value !== (r.mitigation || '') && postRisk({ action: 'update', riskId: r.id, mitigation: e.target.value })} rows={2} className={field} />
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="flex items-center gap-2 pt-1">
                                <select id="add-dim" className={field} defaultValue="">
                                    <option value="" disabled>{L('أضف بُعد خطر…', 'Add a risk dimension…')}</option>
                                    {DIMENSIONS.map(d => <option key={d.key} value={d.key}>{isAr ? d.ar : d.en}</option>)}
                                </select>
                                <button onClick={() => { const el = document.getElementById('add-dim') as HTMLSelectElement; if (el?.value) { postRisk({ action: 'add', dimension: el.value }); el.value = ''; } }} className="px-3 py-1 rounded-lg bg-[#DBA935] text-[#3E3B3F] text-xs font-bold">{L('إضافة', 'Add')}</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* approval gates */}
                <div>
                    <h3 className="text-[#C0C0C0] text-xs font-bold mb-2">{L('بوابات الاعتماد', 'Approval gates')}</h3>
                    {gates.length === 0 ? <p className="text-[#C0C0C0]/60 text-sm">{L('لا توجد بوابات مطلوبة (أو لم تُولَّد بعد).', 'No gates required (or not generated yet).')}</p> : (
                        <div className="space-y-3">
                            {gates.map(g => (
                                <div key={g.id} className="bg-black/20 rounded-lg p-3">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className="text-white text-sm font-bold flex-1 min-w-[180px]">{isAr ? GATE_LABEL[g.gate_type]?.ar : GATE_LABEL[g.gate_type]?.en}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${gateCls(g)}`}>{gateState(g)}</span>
                                    </div>
                                    {g.reason && <p className="text-[#C0C0C0] text-xs mb-2">{g.reason}</p>}
                                    {g.waived ? (
                                        <div className="text-[11px] text-[#C0C0C0]/80">{L('أُعفيت بواسطة', 'Waived by')} {g.waived_by_name} — {g.waived_reason} {canManage && <button onClick={() => postGate({ action: 'unwaive', gateId: g.id })} className="text-[#DBA935] hover:underline ms-2">{L('تراجع', 'undo')}</button>}</div>
                                    ) : (<>
                                        <ApprovalPanel entityType="survey_gate" entityId={g.id} locale={locale} value={0} onStatusChange={() => load()} />
                                        {canManage && !g.satisfied && (
                                            <div className="flex items-center gap-2 mt-2">
                                                <input id={`waive-${g.id}`} placeholder={L('سبب الإعفاء (للمدير)', 'Waive reason (manager)')} className={`${field} flex-1`} />
                                                <button onClick={() => { const el = document.getElementById(`waive-${g.id}`) as HTMLInputElement; if (el?.value.trim()) postGate({ action: 'waive', gateId: g.id, reason: el.value.trim() }); }} className="px-3 py-1 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20">{L('إعفاء', 'Waive')}</button>
                                            </div>
                                        )}
                                    </>)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* clearance */}
                <div className={`rounded-xl border px-3 py-2 flex flex-wrap items-center justify-between gap-2 ${clearance.cleared ? 'bg-green-500/15 border-green-500/40 text-green-300' : 'bg-orange-500/15 border-orange-500/40 text-orange-300'}`}>
                    <span className="text-sm font-bold">{clearance.cleared ? L('كل البوابات مستوفاة — يمكن اعتماد جاهزية المسح.', 'All gates satisfied — the survey can be cleared.') : L(`بوابات غير مستوفاة: ${clearance.blocking}`, `Unsatisfied gates: ${clearance.blocking}`)}</span>
                    {canManage && <button onClick={clearSurvey} disabled={!clearance.cleared} className="px-4 py-1.5 rounded-lg bg-[#DBA935] text-[#3E3B3F] text-xs font-bold disabled:opacity-40">{L('اعتماد جاهزية المسح', 'Clear survey')}</button>}
                </div>
            </>)}
        </div>
    );
}
