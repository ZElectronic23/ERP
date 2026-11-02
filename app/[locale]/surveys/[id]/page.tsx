'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';
import {
    WORK_TYPES, ASSET_CATEGORIES, OS_FAMILIES, RESULT_OPTIONS,
    sectionsFor, computeProgress, type Field,
} from '@/lib/survey/catalog';
import { selectDiagnostics, TIER_LABEL, type DiagProc } from '@/lib/survey/diagnostics';
import PrepChecklist from '@/components/survey/PrepChecklist';
import RiskGates from '@/components/survey/RiskGates';
import SurveyPlanning from '@/components/survey/SurveyPlanning';

type Answers = Record<string, Record<string, any>>;
type DiagResult = { result?: string; observed?: string; note?: string };
interface Asset {
    id?: string; category: string; subcategory?: string; manufacturer?: string; model?: string;
    os_family?: string; os_version?: string; serial?: string; asset_condition?: string; notes?: string;
    diagnostics?: Record<string, DiagResult>;
}

const uid = () => Math.random().toString(36).slice(2);

export default function SurveyBuilderPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const [msg, setMsg] = useState('');

    const [title, setTitle] = useState('');
    const [projectCode, setProjectCode] = useState('');
    const [clientId, setClientId] = useState('');
    const [siteLocation, setSiteLocation] = useState('');
    const [siteContact, setSiteContact] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [status, setStatus] = useState('draft');
    const [workTypes, setWorkTypes] = useState<string[]>([]);
    const [answers, setAnswers] = useState<Answers>({});
    const [assets, setAssets] = useState<Asset[]>([]);
    const [surveyNumber, setSurveyNumber] = useState('');
    const [openDiag, setOpenDiag] = useState<number | null>(null);   // which asset's diagnostics are expanded
    const [openHelp, setOpenHelp] = useState<string | null>(null);   // which procedure's help is open (assetIdx:procId)

    const [projects, setProjects] = useState<{ code: string; name: string }[]>([]);
    const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/surveys/${id}`);
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            const s = j.survey;
            setSurveyNumber(s.survey_number || '');
            setTitle(s.title || ''); setProjectCode(s.project_code || ''); setClientId(s.client_id || '');
            setSiteLocation(s.site_location || ''); setSiteContact(s.site_contact || '');
            setScheduledAt(s.scheduled_at ? String(s.scheduled_at).slice(0, 16) : '');
            setStatus(s.status || 'draft'); setWorkTypes(s.work_types || []); setAnswers(s.answers || {});
            setAssets((j.assets || []).map((a: any) => ({ ...a })));
        } catch (e: any) { setErr(e.message); }
        setLoading(false);
    }, [id]);

    useEffect(() => { load(); }, [load]);

    // link targets (reuse existing clients & projects — no duplicate records)
    useEffect(() => {
        (async () => {
            const [{ data: p }, { data: c }] = await Promise.all([
                supabase.from('projects').select('ProjectCode, ProjectName').is('deleted_at', null).order('created_at', { ascending: false }).limit(200),
                supabase.from('clients').select('ClientId, ClientName').is('deleted_at', null).limit(300),
            ]);
            setProjects((p || []).map((x: any) => ({ code: x.ProjectCode, name: x.ProjectName })));
            setClients((c || []).map((x: any) => ({ id: x.ClientId, name: x.ClientName })));
        })();
    }, []);

    const sections = useMemo(() => sectionsFor(workTypes), [workTypes]);
    const progress = useMemo(() => computeProgress(workTypes, answers), [workTypes, answers]);

    const toggleType = (key: string) => setWorkTypes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    const setAns = (sec: string, field: string, val: any) =>
        setAnswers(prev => ({ ...prev, [sec]: { ...(prev[sec] || {}), [field]: val } }));

    // the standardized "pass" value, in the active language (must not be set without evidence)
    const PASS = isAr ? RESULT_OPTIONS[0].ar : RESULT_OPTIONS[0].en;
    const setDiag = (assetIdx: number, procId: string, patch: Partial<DiagResult>) =>
        setAssets(prev => prev.map((a, i) => i === assetIdx
            ? { ...a, diagnostics: { ...(a.diagnostics || {}), [procId]: { ...(a.diagnostics?.[procId] || {}), ...patch } } }
            : a));
    const copy = (text: string) => { try { navigator.clipboard?.writeText(text); setMsg(L('تم نسخ الأمر', 'Command copied')); setTimeout(() => setMsg(''), 1500); } catch { /* ignore */ } };

    const save = async (newStatus?: string) => {
        setErr(''); setMsg('');
        // A measurement test cannot be marked "pass" without a recorded value (spec §5/§14).
        if (newStatus === 'submitted') {
            const missing: string[] = [];
            assets.forEach((a, i) => {
                for (const proc of selectDiagnostics(a)) {
                    const d = a.diagnostics?.[proc.id];
                    if (d?.result === PASS && proc.record === 'measurement' && !(d.observed || '').trim()) {
                        missing.push(`${i + 1}· ${isAr ? proc.ar : proc.en}`);
                    }
                }
            });
            if (missing.length) {
                setErr(L('لا يمكن تعليم اختبار كـ«ناجح» بدون تسجيل القيمة/الدليل: ', 'A test cannot be "pass" without a recorded value/evidence: ') + missing.join('، '));
                return;
            }
        }
        setSaving(true);
        try {
            const payload: any = {
                title, project_code: projectCode || null, client_id: clientId || null,
                site_location: siteLocation || null, site_contact: siteContact || null,
                scheduled_at: scheduledAt || null, work_types: workTypes, answers, assets,
            };
            if (newStatus) payload.status = newStatus;
            const res = await fetch(`/api/surveys/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            if (newStatus) setStatus(newStatus);
            setMsg(L('تم الحفظ', 'Saved'));
            setTimeout(() => setMsg(''), 2500);
        } catch (e: any) { setErr(e.message); }
        setSaving(false);
    };

    const field = 'w-full bg-black/30 border border-[#DBA935]/20 rounded-lg px-3 py-2 text-sm text-white focus:border-[#DBA935]/60 outline-none';
    const lbl = 'block text-xs text-[#C0C0C0] mb-1';

    const renderField = (secKey: string, f: Field) => {
        const v = answers?.[secKey]?.[f.key];
        const label = isAr ? f.ar : f.en;
        if (f.type === 'bool') {
            return (
                <label key={f.key} className="flex items-center gap-2 text-sm text-white cursor-pointer py-1">
                    <input type="checkbox" checked={!!v} onChange={e => setAns(secKey, f.key, e.target.checked)} className="accent-[#DBA935] w-4 h-4" />
                    <span>{label}</span>
                    {f.help && <span className="text-[10px] text-[#C0C0C0]/70">— {isAr ? f.help.ar : f.help.en}</span>}
                </label>
            );
        }
        const opts = f.type === 'result' ? RESULT_OPTIONS : f.options;
        return (
            <div key={f.key}>
                <label className={lbl}>{label}</label>
                {f.type === 'textarea' ? (
                    <textarea value={v || ''} onChange={e => setAns(secKey, f.key, e.target.value)} rows={2} className={field} />
                ) : f.type === 'number' ? (
                    <input type="number" value={v ?? ''} onChange={e => setAns(secKey, f.key, e.target.value === '' ? '' : Number(e.target.value))} className={field} />
                ) : (f.type === 'select' || f.type === 'result') ? (
                    <select value={v || ''} onChange={e => setAns(secKey, f.key, e.target.value)} className={field}>
                        <option value="">{L('— اختر —', '— select —')}</option>
                        {(opts || []).map((o, i) => <option key={i} value={isAr ? o.ar : o.en}>{isAr ? o.ar : o.en}</option>)}
                    </select>
                ) : (
                    <input type="text" value={v || ''} onChange={e => setAns(secKey, f.key, e.target.value)} className={field} />
                )}
                {f.help && <p className="text-[10px] text-[#C0C0C0]/70 mt-0.5">{isAr ? f.help.ar : f.help.en}</p>}
            </div>
        );
    };

    const renderDiag = (assetIdx: number, proc: DiagProc, n: number) => {
        const d = assets[assetIdx].diagnostics?.[proc.id] || {};
        const helpKey = `${assetIdx}:${proc.id}`;
        const helpOpen = openHelp === helpKey;
        const needsEvidence = d.result === PASS && proc.record === 'measurement' && !(d.observed || '').trim();
        return (
            <div key={proc.id} className="bg-black/30 rounded-xl border border-white/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[#DBA935] font-bold text-sm">{n}· {isAr ? proc.ar : proc.en}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#C0C0C0]">{isAr ? TIER_LABEL[proc.tier].ar : TIER_LABEL[proc.tier].en}</span>
                        {proc.status === 'needs_review'
                            ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">{L('قيد المراجعة', 'Needs review')}</span>
                            : <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">{L('معتمد', 'Approved')}</span>}
                        {proc.privilege !== 'none' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">{proc.privilege === 'root' ? 'root' : L('صلاحية مدير', 'admin')}</span>}
                        {proc.impact !== 'none' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300">{proc.impact === 'service' ? L('يوقف الخدمة مؤقتاً', 'service impact') : L('قد يُعدّل', 'modifies')}</span>}
                    </div>
                    <button onClick={() => setOpenHelp(helpOpen ? null : helpKey)} className="text-[#C0C0C0] text-xs hover:text-[#DBA935] whitespace-nowrap">{helpOpen ? L('إخفاء الشرح', 'Hide help') : L('؟ شرح', '? Help')}</button>
                </div>
                <p className="text-[#C0C0C0] text-xs mb-2">{isAr ? proc.purpose.ar : proc.purpose.en}</p>

                {(proc.tier === 'specialist' || proc.status === 'needs_review') && (
                    <div className="mb-2 text-[11px] text-yellow-300/90 bg-yellow-500/10 rounded-lg px-2 py-1">{L('تحقّق قبل التنفيذ — لا يُعتمد كإجراء قياسي تلقائي.', 'Verify before running — not an auto-approved standard.')}</div>
                )}

                <ol className="list-decimal ps-5 text-sm text-white/90 space-y-0.5 mb-2">
                    {proc.steps.map((s, i) => <li key={i}>{isAr ? s.ar : s.en}</li>)}
                </ol>

                {proc.command && (
                    <div className="flex items-center gap-2 mb-2">
                        <code className="flex-1 bg-black/50 border border-[#DBA935]/20 rounded-lg px-2 py-1 text-xs text-[#DBA935] font-mono overflow-x-auto" dir="ltr">{proc.command}</code>
                        <button onClick={() => copy(proc.command!)} className="px-2 py-1 rounded-lg bg-[#DBA935]/20 text-[#DBA935] text-xs hover:bg-[#DBA935]/30 whitespace-nowrap">{L('نسخ', 'Copy')}</button>
                    </div>
                )}

                <p className="text-[11px] text-[#C0C0C0] mb-2"><span className="text-[#DBA935]">{L('المتوقّع: ', 'Expected: ')}</span>{isAr ? proc.expected.ar : proc.expected.en}</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                        <label className={lbl}>{L('النتيجة', 'Result')}</label>
                        <select value={d.result || ''} onChange={e => setDiag(assetIdx, proc.id, { result: e.target.value })} className={field}>
                            <option value="">{L('— اختر —', '— select —')}</option>
                            {RESULT_OPTIONS.map((o, i) => <option key={i} value={isAr ? o.ar : o.en}>{isAr ? o.ar : o.en}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={lbl}>{proc.record === 'measurement' ? L('القيمة المُسجّلة / الدليل', 'Recorded value / evidence') : L('ملاحظة النتيجة', 'Result note')}</label>
                        <input value={d.observed || ''} onChange={e => setDiag(assetIdx, proc.id, { observed: e.target.value })} className={`${field} ${needsEvidence ? 'border-red-400/60' : ''}`} />
                        {needsEvidence && <p className="text-[10px] text-red-400 mt-0.5">{L('سجّل القيمة لاعتماد «ناجح».', 'Record the value to mark "pass".')}</p>}
                    </div>
                    <div>
                        <label className={lbl}>{L('ملاحظات / سبب', 'Notes / reason')}</label>
                        <input value={d.note || ''} onChange={e => setDiag(assetIdx, proc.id, { note: e.target.value })} className={field} />
                    </div>
                </div>

                {helpOpen && (
                    <div className="mt-2 text-[11px] text-[#C0C0C0] bg-black/40 rounded-lg p-2 space-y-1">
                        <p><span className="text-[#DBA935]">{L('التفسير: ', 'Interpretation: ')}</span>{isAr ? proc.interpretation.ar : proc.interpretation.en}</p>
                        {proc.limitations && <p><span className="text-[#DBA935]">{L('القيود: ', 'Limitations: ')}</span>{isAr ? proc.limitations.ar : proc.limitations.en}</p>}
                        {proc.app && <p><span className="text-[#DBA935]">{L('الأداة: ', 'Tool: ')}</span>{isAr ? proc.app.ar : proc.app.en}</p>}
                        <p><span className="text-[#DBA935]">{L('المصدر: ', 'Source: ')}</span>{proc.source} — {L('تحقّق', 'verified')} {proc.verified_on}</p>
                        <a href={`/${locale}/knowledge?code=${proc.id}`} target="_blank" rel="noopener noreferrer" className="inline-block text-[#DBA935] hover:underline">📚 {L('عرض الإجراء في المكتبة', 'Open in the library')}</a>
                    </div>
                )}
            </div>
        );
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</div>;

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="max-w-5xl mx-auto space-y-4">
                {/* header */}
                <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20">
                    <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                        <div>
                            <button onClick={() => router.push(`/${locale}/surveys`)} className="text-[#C0C0C0] text-xs hover:text-[#DBA935]">← {L('كل عمليات المسح', 'All surveys')}</button>
                            <h1 className="text-xl font-bold text-[#DBA935] mt-1">{L('المسح الفني', 'Technical Survey')} <span className="font-mono text-sm text-[#C0C0C0]">{surveyNumber}</span></h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-[#DBA935]" style={{ width: `${progress}%` }} /></div>
                                <span className="text-xs text-[#C0C0C0]">{progress}%</span>
                            </div>
                            <button onClick={() => save()} disabled={saving} className="px-4 py-2 rounded-lg bg-white/10 text-white font-bold text-sm hover:bg-white/20 disabled:opacity-50">{saving ? L('...حفظ', 'Saving...') : L('حفظ', 'Save')}</button>
                            <button onClick={() => save('submitted')} disabled={saving} className="px-4 py-2 rounded-lg bg-[#DBA935] text-[#3E3B3F] font-bold text-sm hover:bg-[#DBA935]/90 disabled:opacity-50">{L('إرسال', 'Submit')}</button>
                        </div>
                    </div>
                    {err && <div className="mb-3 text-red-400 text-sm">{err}</div>}
                    {msg && <div className="mb-3 text-green-400 text-sm">{msg}</div>}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div><label className={lbl}>{L('عنوان المسح', 'Survey title')}</label><input value={title} onChange={e => setTitle(e.target.value)} className={field} /></div>
                        <div><label className={lbl}>{L('المشروع المرتبط', 'Linked project')}</label>
                            <select value={projectCode} onChange={e => setProjectCode(e.target.value)} className={field}>
                                <option value="">{L('— بدون —', '— none —')}</option>
                                {projects.map(p => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
                            </select>
                        </div>
                        <div><label className={lbl}>{L('العميل المرتبط', 'Linked client')}</label>
                            <select value={clientId} onChange={e => setClientId(e.target.value)} className={field}>
                                <option value="">{L('— بدون —', '— none —')}</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div><label className={lbl}>{L('موقع الزيارة', 'Site location')}</label><input value={siteLocation} onChange={e => setSiteLocation(e.target.value)} className={field} /></div>
                        <div><label className={lbl}>{L('مسؤول التواصل بالموقع', 'Site contact')}</label><input value={siteContact} onChange={e => setSiteContact(e.target.value)} className={field} /></div>
                        <div><label className={lbl}>{L('موعد الزيارة', 'Scheduled visit')}</label><input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className={field} /></div>
                    </div>
                </div>

                {/* work types */}
                <div className="bg-black/40 backdrop-blur-sm p-4 md:p-5 rounded-3xl border border-[#DBA935]/20">
                    <h2 className="text-[#DBA935] font-bold mb-1">{L('نوع العمل / الخدمة', 'Work / service type')}</h2>
                    <p className="text-[#C0C0C0] text-xs mb-3">{L('اختر نوعاً واحداً أو أكثر — ستظهر الأقسام المناسبة تلقائياً.', 'Pick one or more — the relevant sections appear automatically.')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {WORK_TYPES.map(w => (
                            <label key={w.key} className={`flex items-center gap-2 text-sm cursor-pointer rounded-lg px-3 py-2 border transition ${workTypes.includes(w.key) ? 'bg-[#DBA935]/15 border-[#DBA935]/50 text-white' : 'bg-white/5 border-white/10 text-[#C0C0C0] hover:bg-white/10'}`}>
                                <input type="checkbox" checked={workTypes.includes(w.key)} onChange={() => toggleType(w.key)} className="accent-[#DBA935] w-4 h-4" />
                                {isAr ? w.ar : w.en}
                            </label>
                        ))}
                    </div>
                </div>

                {/* assets */}
                <div className="bg-black/40 backdrop-blur-sm p-4 md:p-5 rounded-3xl border border-[#DBA935]/20">
                    <div className="flex justify-between items-center mb-3">
                        <div>
                            <h2 className="text-[#DBA935] font-bold">{L('الأجهزة / الأصول', 'Assets')}</h2>
                            <p className="text-[#C0C0C0] text-xs">{L('يدعم أنواع أجهزة متعددة. أكّد نظام التشغيل فعلياً — لا تفترضه من نوع الجهاز.', 'Supports multiple asset types. Confirm the OS — never assume it from the device.')}</p>
                        </div>
                        <button onClick={() => setAssets(p => [...p, { id: uid(), category: 'windows_pc', os_family: 'windows' }])} className="px-3 py-1.5 rounded-lg bg-[#DBA935]/20 text-[#DBA935] text-xs font-bold hover:bg-[#DBA935]/30">+ {L('إضافة جهاز', 'Add asset')}</button>
                    </div>
                    {assets.length === 0 ? <p className="text-[#C0C0C0]/60 text-sm py-3">{L('لا توجد أجهزة مضافة.', 'No assets added.')}</p> : (
                        <div className="space-y-3">
                            {assets.map((a, idx) => {
                                const diags = selectDiagnostics(a);
                                const done = diags.filter(pr => a.diagnostics?.[pr.id]?.result).length;
                                return (
                                    <div key={a.id || idx} className="bg-black/20 rounded-xl p-2">
                                        <div className="grid grid-cols-2 md:grid-cols-7 gap-2 items-center">
                                            <select value={a.category} onChange={e => setAssets(p => p.map((x, i) => i === idx ? { ...x, category: e.target.value } : x))} className={field}>
                                                {ASSET_CATEGORIES.map(c => <option key={c.key} value={c.key}>{isAr ? c.ar : c.en}</option>)}
                                            </select>
                                            <input placeholder={L('الشركة', 'Make')} value={a.manufacturer || ''} onChange={e => setAssets(p => p.map((x, i) => i === idx ? { ...x, manufacturer: e.target.value } : x))} className={field} />
                                            <input placeholder={L('الموديل', 'Model')} value={a.model || ''} onChange={e => setAssets(p => p.map((x, i) => i === idx ? { ...x, model: e.target.value } : x))} className={field} />
                                            <select value={a.os_family || ''} onChange={e => setAssets(p => p.map((x, i) => i === idx ? { ...x, os_family: e.target.value } : x))} className={field}>
                                                <option value="">{L('نظام التشغيل', 'OS')}</option>
                                                {OS_FAMILIES.map(o => <option key={o.key} value={o.key}>{isAr ? o.ar : o.en}</option>)}
                                            </select>
                                            <input placeholder={L('إصدار النظام', 'OS version')} value={a.os_version || ''} onChange={e => setAssets(p => p.map((x, i) => i === idx ? { ...x, os_version: e.target.value } : x))} className={field} />
                                            <input placeholder={L('الرقم التسلسلي', 'Serial')} value={a.serial || ''} onChange={e => setAssets(p => p.map((x, i) => i === idx ? { ...x, serial: e.target.value } : x))} className={field} />
                                            <button onClick={() => setAssets(p => p.filter((_, i) => i !== idx))} className="text-red-400 text-xs hover:text-red-300">{L('حذف', 'Remove')}</button>
                                        </div>
                                        <div className="mt-2">
                                            <button onClick={() => setOpenDiag(openDiag === idx ? null : idx)} className="text-xs text-[#DBA935] hover:underline">
                                                {openDiag === idx ? '▾' : '▸'} {L('التشخيص الموجّه', 'Guided diagnostics')} ({done}/{diags.length})
                                            </button>
                                        </div>
                                        {openDiag === idx && (
                                            <div className="mt-2 space-y-2">
                                                {diags.length === 0
                                                    ? <p className="text-[#C0C0C0]/60 text-xs">{L('لا توجد إجراءات مطابقة لهذا الجهاز.', 'No procedures match this asset.')}</p>
                                                    : diags.map((pr, i) => renderDiag(idx, pr, i + 1))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* pre-visit preparation checklist (persists independently) */}
                <PrepChecklist surveyId={id} locale={locale} />

                {/* evidence-based risk assessment + approval gates (persists independently) */}
                <RiskGates surveyId={id} locale={locale} />

                {/* planning & pricing bridge → existing project planning module */}
                <SurveyPlanning surveyId={id} locale={locale} projectCode={projectCode} />

                {/* dynamic sections */}
                {sections.map(sec => (
                    <div key={sec.key} className="bg-black/40 backdrop-blur-sm p-4 md:p-5 rounded-3xl border border-[#DBA935]/20">
                        <h2 className="text-[#DBA935] font-bold mb-3">{isAr ? sec.ar : sec.en}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {sec.fields.map(f => renderField(sec.key, f))}
                        </div>
                    </div>
                ))}

                {workTypes.length === 0 && (
                    <div className="text-center text-[#C0C0C0]/60 text-sm py-6">{L('اختر نوع العمل بالأعلى لإظهار أقسام المسح.', 'Pick a work type above to reveal the survey sections.')}</div>
                )}
            </div>
        </div>
    );
}
