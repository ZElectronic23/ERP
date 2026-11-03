'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { ASSET_CATEGORIES, OS_FAMILIES } from '@/lib/survey/catalog';
import { TIER_LABEL } from '@/lib/survey/diagnostics';

type Tab = 'procedures' | 'software';

// Difficulty / effort level (support → expert) — directive #2.
const DIFFICULTY: Record<string, { ar: string; en: string; cls: string }> = {
    beginner: { ar: 'مبتدئ', en: 'Beginner', cls: 'bg-green-500/15 text-green-300 border-green-500/30' },
    intermediate: { ar: 'متوسط', en: 'Intermediate', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
    advanced: { ar: 'متقدّم', en: 'Advanced', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
    expert: { ar: 'خبير', en: 'Expert', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
};
// Command family — explicit per the directive (CMD/PowerShell/Bash/Linux/SQL).
const COMMAND_TYPE: Record<string, { ar: string; en: string }> = {
    cmd: { ar: 'CMD', en: 'CMD' },
    powershell: { ar: 'PowerShell', en: 'PowerShell' },
    bash: { ar: 'Bash', en: 'Bash' },
    linux: { ar: 'Linux Shell', en: 'Linux Shell' },
    sql: { ar: 'SQL', en: 'SQL' },
    gui: { ar: 'واجهة رسومية', en: 'GUI' },
    other: { ar: 'أخرى', en: 'Other' },
};
// FREE-first pricing label (open-source alternatives before paid) — directive #2.
const PRICING: Record<string, { ar: string; en: string; cls: string }> = {
    free: { ar: 'مجاني', en: 'FREE', cls: 'bg-green-500/20 text-green-300 border-green-500/40' },
    freemium: { ar: 'مجاني جزئياً', en: 'FREEMIUM', cls: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
    paid: { ar: 'مدفوع', en: 'PAID', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
};
const PRICING_RANK: Record<string, number> = { free: 0, freemium: 1, paid: 2 };

const STATUS: Record<string, { ar: string; en: string; cls: string }> = {
    draft: { ar: 'مسودة', en: 'Draft', cls: 'bg-silver/20 text-silver' },
    review: { ar: 'قيد المراجعة', en: 'In review', cls: 'bg-yellow-500/20 text-yellow-300' },
    approved: { ar: 'معتمد', en: 'Approved', cls: 'bg-green-500/20 text-green-300' },
    needs_update: { ar: 'يحتاج تحديثاً', en: 'Needs update', cls: 'bg-orange-500/20 text-orange-300' },
    suspended: { ar: 'موقوف', en: 'Suspended', cls: 'bg-red-500/20 text-red-300' },
};
const COMMERCIAL: Record<string, { ar: string; en: string }> = {
    allowed: { ar: 'مسموح تجارياً', en: 'Commercial allowed' },
    restricted: { ar: 'مقيّد تجارياً', en: 'Commercially restricted' },
    unknown: { ar: 'الترخيص غير محدد', en: 'Licensing unknown' },
};

export default function KnowledgePage() {
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [tab, setTab] = useState<Tab>('procedures');
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('');
    // client-side facets (applied on the fetched set — keeps one fetch path)
    const [fCat, setFCat] = useState('');
    const [fOs, setFOs] = useState('');
    const [fDiff, setFDiff] = useState('');
    const [fCmd, setFCmd] = useState('');
    const [fPrice, setFPrice] = useState('');
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [canEdit, setCanEdit] = useState(false);
    const [canApprove, setCanApprove] = useState(false);
    const [view, setView] = useState<any | null>(null);     // read-only detail
    const [edit, setEdit] = useState<any | null>(null);     // editor form state (null = closed)

    // read ?tab / ?q / ?code from the URL (used by the diagnostics "in library" link)
    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        if (sp.get('tab') === 'software') setTab('software');
        const code = sp.get('code'); const qq = sp.get('q');
        if (code) setQ(code); else if (qq) setQ(qq);
    }, []);

    const load = useCallback(async () => {
        setLoading(true); setErr('');
        try {
            const p = new URLSearchParams();
            if (q) p.set('q', q);
            if (status) p.set('status', status);
            const res = await fetch(`/api/knowledge/${tab}?${p.toString()}`);
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            setRows(j[tab] || []);
            setCanEdit(!!j.canEdit); setCanApprove(!!j.canApprove);
        } catch (e: any) { setErr(e.message); }
        setLoading(false);
    }, [tab, q, status]);

    useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

    // apply the facet filters + FREE-first ordering on the already-fetched rows
    const shown = useMemo(() => {
        let r = rows;
        if (tab === 'procedures') {
            if (fCat) r = r.filter(x => (x.categories || []).includes(fCat));
            if (fOs) r = r.filter(x => (x.os_families || []).includes(fOs));
            if (fCmd) r = r.filter(x => x.command_type === fCmd);
        } else {
            if (fOs) r = r.filter(x => (x.supported_os || []).includes(fOs));
            if (fPrice) r = r.filter(x => x.pricing === fPrice);
        }
        if (fDiff) r = r.filter(x => x.difficulty === fDiff);
        if (tab === 'software') r = [...r].sort((a, b) =>
            (PRICING_RANK[a.pricing] ?? 3) - (PRICING_RANK[b.pricing] ?? 3) || String(a.name || '').localeCompare(String(b.name || '')));
        return r;
    }, [rows, tab, fCat, fOs, fDiff, fCmd, fPrice]);
    const resetFacets = () => { setFCat(''); setFOs(''); setFDiff(''); setFCmd(''); setFPrice(''); };

    const save = async () => {
        if (!edit) return;
        try {
            const isNew = !edit.id;
            const url = isNew ? `/api/knowledge/${tab}` : `/api/knowledge/${tab}/${edit.id}`;
            const res = await fetch(url, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit) });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            setEdit(null); setView(null); load();
        } catch (e: any) { setErr(e.message); }
    };

    const field = 'w-full bg-black/30 border border-[#DBA935]/20 rounded-lg px-3 py-2 text-sm text-white focus:border-[#DBA935]/60 outline-none';
    const lbl = 'block text-xs text-[#C0C0C0] mb-1';
    const statusBadge = (s: string) => { const x = STATUS[s] || STATUS.draft; return <span className={`px-2 py-0.5 rounded-full text-[11px] ${x.cls}`}>{isAr ? x.ar : x.en}</span>; };

    const newRecord = () => setEdit(tab === 'procedures'
        ? { title_ar: '', categories: [], os_families: [], privilege: 'none', impact: 'none', review_status: 'draft' }
        : { name: '', supported_os: [], commercial_use: 'unknown', review_status: 'draft' });

    const toggleArr = (key: string, val: string) => setEdit((e: any) => {
        const arr: string[] = e[key] || [];
        return { ...e, [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] };
    });
    const set = (k: string, v: any) => setEdit((e: any) => ({ ...e, [k]: v }));

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#DBA935]">{L('مكتبة المعرفة التقنية', 'Technical Knowledge Library')}</h1>
                        <p className="text-[#C0C0C0] text-sm mt-1">{L('إجراءات وأوامر وبرامج معتمدة قابلة للبحث — المعتمد فقط يُوصى به تلقائياً.', 'Searchable approved procedures, commands and software — only approved items are auto-recommended.')}</p>
                    </div>
                    {canEdit && <button onClick={newRecord} className="px-4 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm">+ {L('سجل جديد', 'New record')}</button>}
                </div>

                {/* tabs */}
                <div className="flex gap-2 mb-4">
                    {([['procedures', L('الإجراءات', 'Procedures')], ['software', L('البرامج المعتمدة', 'Approved software')]] as const).map(([k, lab]) => (
                        <button key={k} onClick={() => { setTab(k as Tab); setRows([]); resetFacets(); }} className={`px-4 py-2 rounded-xl text-sm transition ${tab === k ? 'bg-[#DBA935] text-[#3E3B3F] font-bold' : 'bg-white/5 text-[#C0C0C0] hover:bg-white/10'}`}>{lab}</button>
                    ))}
                </div>

                {/* search + filter */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder={L('ابحث باسم/أمر/جهاز/برنامج...', 'Search title/command/tool...')} className={`${field} flex-1 min-w-[200px]`} />
                    <select value={status} onChange={e => setStatus(e.target.value)} className={`${field} w-auto`}>
                        <option value="">{L('كل الحالات', 'All statuses')}</option>
                        {Object.keys(STATUS).map(s => <option key={s} value={s}>{isAr ? STATUS[s].ar : STATUS[s].en}</option>)}
                    </select>
                </div>

                {/* advanced facets */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {tab === 'procedures' && (
                        <select value={fCat} onChange={e => setFCat(e.target.value)} className={`${field} w-auto`}>
                            <option value="">{L('كل الفئات', 'All categories')}</option>
                            {ASSET_CATEGORIES.map(c => <option key={c.key} value={c.key}>{isAr ? c.ar : c.en}</option>)}
                        </select>
                    )}
                    <select value={fOs} onChange={e => setFOs(e.target.value)} className={`${field} w-auto`}>
                        <option value="">{L('كل أنظمة التشغيل', 'All OS')}</option>
                        {OS_FAMILIES.map(o => <option key={o.key} value={o.key}>{isAr ? o.ar : o.en}</option>)}
                    </select>
                    <select value={fDiff} onChange={e => setFDiff(e.target.value)} className={`${field} w-auto`}>
                        <option value="">{L('كل المستويات', 'All levels')}</option>
                        {Object.keys(DIFFICULTY).map(d => <option key={d} value={d}>{isAr ? DIFFICULTY[d].ar : DIFFICULTY[d].en}</option>)}
                    </select>
                    {tab === 'procedures' && (
                        <select value={fCmd} onChange={e => setFCmd(e.target.value)} className={`${field} w-auto`}>
                            <option value="">{L('كل أنواع الأوامر', 'All command types')}</option>
                            {Object.keys(COMMAND_TYPE).map(c => <option key={c} value={c}>{isAr ? COMMAND_TYPE[c].ar : COMMAND_TYPE[c].en}</option>)}
                        </select>
                    )}
                    {tab === 'software' && (
                        <select value={fPrice} onChange={e => setFPrice(e.target.value)} className={`${field} w-auto`}>
                            <option value="">{L('مجاني ومدفوع', 'Free & paid')}</option>
                            {Object.keys(PRICING).map(p => <option key={p} value={p}>{isAr ? PRICING[p].ar : PRICING[p].en}</option>)}
                        </select>
                    )}
                    {(fCat || fOs || fDiff || fCmd || fPrice) && (
                        <button onClick={resetFacets} className="px-3 py-2 rounded-lg bg-white/5 text-[#C0C0C0] text-xs hover:bg-white/10">✕ {L('مسح الفلاتر', 'Clear filters')}</button>
                    )}
                </div>

                {err && <div className="mb-3 text-red-400 text-sm">{err}</div>}

                {loading ? <div className="text-center py-16 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</div>
                    : shown.length === 0 ? <div className="text-center py-16 text-[#C0C0C0] text-sm">{tab === 'software'
                        ? L('لا توجد برامج بعد. يضيفها المختص بالحقول الإلزامية (المصدر الرسمي، الترخيص، تاريخ التحقق).', 'No software yet. A specialist adds entries with the required fields (official source, licensing, verification date).')
                        : L('لا توجد نتائج.', 'No results.')}</div>
                        : (
                            <>
                            <div className="text-[11px] text-[#C0C0C0]/70 mb-2">{shown.length} {L('عنصر', shown.length === 1 ? 'item' : 'items')}</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {shown.map(r => (
                                    <div key={r.id} onClick={() => setView(r)} className="bg-black/30 rounded-xl border border-white/10 p-3 cursor-pointer hover:border-[#DBA935]/40 transition">
                                        <div className="flex justify-between items-start gap-2 mb-1">
                                            <span className="text-white font-bold text-sm">{tab === 'procedures' ? r.title_ar : r.name}</span>
                                            {statusBadge(r.review_status)}
                                        </div>
                                        <p className="text-[#C0C0C0] text-xs line-clamp-2">{r.purpose || '—'}</p>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {tab === 'software' && r.pricing && <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${PRICING[r.pricing]?.cls}`}>{isAr ? PRICING[r.pricing]?.ar : PRICING[r.pricing]?.en}</span>}
                                            {r.difficulty && <span className={`text-[10px] px-2 py-0.5 rounded-full border ${DIFFICULTY[r.difficulty]?.cls}`}>{isAr ? DIFFICULTY[r.difficulty]?.ar : DIFFICULTY[r.difficulty]?.en}</span>}
                                            {tab === 'procedures' && r.command_type && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#DBA935]/15 text-[#DBA935] border border-[#DBA935]/30 font-mono">{isAr ? COMMAND_TYPE[r.command_type]?.ar : COMMAND_TYPE[r.command_type]?.en}</span>}
                                            {tab === 'procedures' && r.tier && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#C0C0C0]">{isAr ? TIER_LABEL[r.tier as keyof typeof TIER_LABEL]?.ar : TIER_LABEL[r.tier as keyof typeof TIER_LABEL]?.en}</span>}
                                            {tab === 'procedures' && (r.os_families || []).map((o: string) => <span key={o} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#C0C0C0]">{o}</span>)}
                                            {tab === 'procedures' && r.est_minutes && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#C0C0C0]">⏱ {r.est_minutes}{L('د', 'm')}</span>}
                                            {tab === 'software' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#C0C0C0]">{isAr ? COMMERCIAL[r.commercial_use]?.ar : COMMERCIAL[r.commercial_use]?.en}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            </>
                        )}
            </div>

            {/* read-only detail */}
            {view && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={() => setView(null)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 rounded-2xl shadow-2xl border border-[#DBA935]/30 w-full max-w-2xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start p-5 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]">
                            <div><h2 className="text-lg font-alata text-[#DBA935]">{tab === 'procedures' ? view.title_ar : view.name}</h2>
                                <div className="mt-1 flex items-center gap-2">{statusBadge(view.review_status)}<span className="text-silver/60 text-[11px]">v{view.version}{view.verified_on ? ` · ${L('تحقّق', 'verified')} ${view.verified_on}` : ''}</span></div></div>
                            <div className="flex gap-2">
                                {canEdit && <button onClick={() => { setEdit({ ...view }); setView(null); }} className="text-[#DBA935] text-sm px-2 py-1 hover:bg-[#DBA935]/10 rounded">{L('تعديل', 'Edit')}</button>}
                                <button onClick={() => setView(null)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                            </div>
                        </div>
                        <div className="p-5 text-sm text-[#C0C0C0] space-y-2">
                            {view.purpose && <p><span className="text-[#DBA935]">{L('الغرض: ', 'Purpose: ')}</span>{view.purpose}</p>}
                            {tab === 'procedures' ? (<>
                                {view.instructions && <div><span className="text-[#DBA935]">{L('الخطوات:', 'Steps:')}</span><pre className="whitespace-pre-wrap font-sans text-white/90 mt-1">{view.instructions}</pre></div>}
                                {view.command && <p dir="ltr"><span className="text-[#DBA935]">{L('الأمر: ', 'Command: ')}</span><code className="text-[#DBA935] font-mono">{view.command}</code></p>}
                                {view.expected && <p><span className="text-[#DBA935]">{L('المتوقّع: ', 'Expected: ')}</span>{view.expected}</p>}
                                {view.interpretation && <p><span className="text-[#DBA935]">{L('التفسير: ', 'Interpretation: ')}</span>{view.interpretation}</p>}
                                {view.limitations && <p><span className="text-[#DBA935]">{L('القيود: ', 'Limitations: ')}</span>{view.limitations}</p>}
                                {view.prerequisites && <p><span className="text-[#DBA935]">{L('المتطلبات: ', 'Prerequisites: ')}</span>{view.prerequisites}</p>}
                                {view.qualification && <p><span className="text-[#DBA935]">{L('المؤهّل المطلوب: ', 'Qualification: ')}</span>{view.qualification}</p>}
                                <p><span className="text-[#DBA935]">{L('الصلاحية/الأثر: ', 'Privilege/impact: ')}</span>{view.privilege} · {view.impact}{view.data_loss_risk ? ` · ${L('خطر فقد بيانات', 'data-loss risk')}` : ''}</p>
                                {(view.difficulty || view.command_type || view.est_minutes) && <p><span className="text-[#DBA935]">{L('التصنيف: ', 'Classification: ')}</span>{[view.difficulty && (isAr ? DIFFICULTY[view.difficulty]?.ar : DIFFICULTY[view.difficulty]?.en), view.command_type && (isAr ? COMMAND_TYPE[view.command_type]?.ar : COMMAND_TYPE[view.command_type]?.en), view.est_minutes && `⏱ ${view.est_minutes}${L('د', 'm')}`].filter(Boolean).join(' · ')}</p>}
                            </>) : (<>
                                {view.publisher && <p><span className="text-[#DBA935]">{L('الناشر: ', 'Publisher: ')}</span>{view.publisher}</p>}
                                {view.official_source && <p dir="ltr"><span className="text-[#DBA935]">{L('المصدر الرسمي: ', 'Official source: ')}</span>{view.official_source}</p>}
                                {view.approved_version && <p><span className="text-[#DBA935]">{L('الإصدار المعتمد: ', 'Approved version: ')}</span>{view.approved_version}</p>}
                                {view.install_instructions && <p><span className="text-[#DBA935]">{L('التثبيت: ', 'Install: ')}</span>{view.install_instructions}</p>}
                                <p><span className="text-[#DBA935]">{L('الترخيص: ', 'Licensing: ')}</span>{view.licensing || '—'} ({isAr ? COMMERCIAL[view.commercial_use]?.ar : COMMERCIAL[view.commercial_use]?.en})</p>
                                {(view.pricing || view.difficulty) && <p><span className="text-[#DBA935]">{L('التصنيف: ', 'Classification: ')}</span>{[view.pricing && (isAr ? PRICING[view.pricing]?.ar : PRICING[view.pricing]?.en), view.difficulty && (isAr ? DIFFICULTY[view.difficulty]?.ar : DIFFICULTY[view.difficulty]?.en)].filter(Boolean).join(' · ')}</p>}
                                {view.security_review && <p><span className="text-[#DBA935]">{L('المراجعة الأمنية: ', 'Security review: ')}</span>{view.security_review}</p>}
                                {view.limitations && <p><span className="text-[#DBA935]">{L('القيود: ', 'Limitations: ')}</span>{view.limitations}</p>}
                            </>)}
                            {view.source && <p><span className="text-[#DBA935]">{L('المصدر: ', 'Source: ')}</span>{view.source}</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* editor */}
            {edit && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={() => setEdit(null)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 rounded-2xl shadow-2xl border border-[#DBA935]/30 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]">
                            <h2 className="text-lg font-alata text-[#DBA935]">{edit.id ? L('تعديل سجل', 'Edit record') : L('سجل جديد', 'New record')}</h2>
                            <button onClick={() => setEdit(null)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {tab === 'procedures' ? (<>
                                <div><label className={lbl}>{L('العنوان (عربي) *', 'Title (AR) *')}</label><input value={edit.title_ar || ''} onChange={e => set('title_ar', e.target.value)} className={field} /></div>
                                <div><label className={lbl}>{L('العنوان (إنجليزي)', 'Title (EN)')}</label><input value={edit.title_en || ''} onChange={e => set('title_en', e.target.value)} className={field} /></div>
                                <div className="md:col-span-2"><label className={lbl}>{L('الغرض', 'Purpose')}</label><input value={edit.purpose || ''} onChange={e => set('purpose', e.target.value)} className={field} /></div>
                                <div className="md:col-span-2"><label className={lbl}>{L('الفئات', 'Categories')}</label><div className="flex flex-wrap gap-1">{ASSET_CATEGORIES.map(c => <button key={c.key} type="button" onClick={() => toggleArr('categories', c.key)} className={`text-[11px] px-2 py-1 rounded-full border ${(edit.categories || []).includes(c.key) ? 'bg-[#DBA935]/20 border-[#DBA935]/50 text-white' : 'bg-white/5 border-white/10 text-[#C0C0C0]'}`}>{isAr ? c.ar : c.en}</button>)}</div></div>
                                <div className="md:col-span-2"><label className={lbl}>{L('أنظمة التشغيل', 'OS families')}</label><div className="flex flex-wrap gap-1">{OS_FAMILIES.map(o => <button key={o.key} type="button" onClick={() => toggleArr('os_families', o.key)} className={`text-[11px] px-2 py-1 rounded-full border ${(edit.os_families || []).includes(o.key) ? 'bg-[#DBA935]/20 border-[#DBA935]/50 text-white' : 'bg-white/5 border-white/10 text-[#C0C0C0]'}`}>{isAr ? o.ar : o.en}</button>)}</div></div>
                                <div className="md:col-span-2"><label className={lbl}>{L('الخطوات (سطر لكل خطوة)', 'Steps (one per line)')}</label><textarea rows={4} value={edit.instructions || ''} onChange={e => set('instructions', e.target.value)} className={field} /></div>
                                <div><label className={lbl}>{L('الأمر', 'Command')}</label><input dir="ltr" value={edit.command || ''} onChange={e => set('command', e.target.value)} className={field} /></div>
                                <div><label className={lbl}>{L('الطريقة', 'Method tier')}</label><select value={edit.tier || ''} onChange={e => set('tier', e.target.value)} className={field}><option value="">—</option>{Object.keys(TIER_LABEL).map(k => <option key={k} value={k}>{isAr ? TIER_LABEL[k as keyof typeof TIER_LABEL].ar : TIER_LABEL[k as keyof typeof TIER_LABEL].en}</option>)}</select></div>
                                <div><label className={lbl}>{L('المتوقّع / معيار القبول', 'Expected / acceptance')}</label><input value={edit.expected || ''} onChange={e => set('expected', e.target.value)} className={field} /></div>
                                <div><label className={lbl}>{L('التفسير', 'Interpretation')}</label><input value={edit.interpretation || ''} onChange={e => set('interpretation', e.target.value)} className={field} /></div>
                                <div><label className={lbl}>{L('القيود', 'Limitations')}</label><input value={edit.limitations || ''} onChange={e => set('limitations', e.target.value)} className={field} /></div>
                                <div><label className={lbl}>{L('المتطلبات المسبقة', 'Prerequisites')}</label><input value={edit.prerequisites || ''} onChange={e => set('prerequisites', e.target.value)} className={field} /></div>
                                <div><label className={lbl}>{L('المؤهّل المطلوب', 'Required qualification')}</label><input value={edit.qualification || ''} onChange={e => set('qualification', e.target.value)} className={field} /></div>
                                <div><label className={lbl}>{L('الصلاحية', 'Privilege')}</label><select value={edit.privilege || 'none'} onChange={e => set('privilege', e.target.value)} className={field}><option value="none">{L('لا شيء', 'none')}</option><option value="admin">admin</option><option value="root">root</option></select></div>
                                <div><label className={lbl}>{L('الأثر على الخدمة', 'Service impact')}</label><select value={edit.impact || 'none'} onChange={e => set('impact', e.target.value)} className={field}><option value="none">{L('لا شيء', 'none')}</option><option value="modifies">{L('قد يُعدّل', 'modifies')}</option><option value="service">{L('يوقف الخدمة', 'service')}</option></select></div>
                                <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={!!edit.data_loss_risk} onChange={e => set('data_loss_risk', e.target.checked)} className="accent-[#DBA935] w-4 h-4" />{L('خطر فقد بيانات', 'Data-loss risk')}</label>
                                <div><label className={lbl}>{L('زمن التنفيذ (دقيقة)', 'Est. minutes')}</label><input type="number" value={edit.est_minutes ?? ''} onChange={e => set('est_minutes', e.target.value)} className={field} /></div>
                                <div><label className={lbl}>{L('مستوى الصعوبة', 'Difficulty level')}</label><select value={edit.difficulty || ''} onChange={e => set('difficulty', e.target.value)} className={field}><option value="">—</option>{Object.keys(DIFFICULTY).map(d => <option key={d} value={d}>{isAr ? DIFFICULTY[d].ar : DIFFICULTY[d].en}</option>)}</select></div>
                                <div><label className={lbl}>{L('نوع الأمر', 'Command type')}</label><select value={edit.command_type || ''} onChange={e => set('command_type', e.target.value)} className={field}><option value="">—</option>{Object.keys(COMMAND_TYPE).map(c => <option key={c} value={c}>{isAr ? COMMAND_TYPE[c].ar : COMMAND_TYPE[c].en}</option>)}</select></div>
                            </>) : (<>
                                <div><label className={lbl}>{L('اسم البرنامج *', 'Name *')}</label><input value={edit.name || ''} onChange={e => set('name', e.target.value)} className={field} /></div>
                                <div><label className={lbl}>{L('الناشر', 'Publisher')}</label><input value={edit.publisher || ''} onChange={e => set('publisher', e.target.value)} className={field} /></div>
                                <div className="md:col-span-2"><label className={lbl}>{L('الغرض', 'Purpose')}</label><input value={edit.purpose || ''} onChange={e => set('purpose', e.target.value)} className={field} /></div>
                                <div className="md:col-span-2"><label className={lbl}>{L('المصدر الرسمي (رابط التحميل/التوثيق)', 'Official source (download/docs URL)')}</label><input dir="ltr" value={edit.official_source || ''} onChange={e => set('official_source', e.target.value)} className={field} /></div>
                                <div className="md:col-span-2"><label className={lbl}>{L('أنظمة التشغيل المدعومة', 'Supported OS')}</label><div className="flex flex-wrap gap-1">{OS_FAMILIES.map(o => <button key={o.key} type="button" onClick={() => toggleArr('supported_os', o.key)} className={`text-[11px] px-2 py-1 rounded-full border ${(edit.supported_os || []).includes(o.key) ? 'bg-[#DBA935]/20 border-[#DBA935]/50 text-white' : 'bg-white/5 border-white/10 text-[#C0C0C0]'}`}>{isAr ? o.ar : o.en}</button>)}</div></div>
                                <div><label className={lbl}>{L('الإصدار المعتمد', 'Approved version')}</label><input value={edit.approved_version || ''} onChange={e => set('approved_version', e.target.value)} className={field} /></div>
                                <div><label className={lbl}>{L('الاستخدام التجاري', 'Commercial use')}</label><select value={edit.commercial_use || 'unknown'} onChange={e => set('commercial_use', e.target.value)} className={field}>{Object.keys(COMMERCIAL).map(k => <option key={k} value={k}>{isAr ? COMMERCIAL[k].ar : COMMERCIAL[k].en}</option>)}</select></div>
                                <div><label className={lbl}>{L('التسعير (مجاني أولاً)', 'Pricing (free first)')}</label><select value={edit.pricing || ''} onChange={e => set('pricing', e.target.value)} className={field}><option value="">—</option>{Object.keys(PRICING).map(p => <option key={p} value={p}>{isAr ? PRICING[p].ar : PRICING[p].en}</option>)}</select></div>
                                <div><label className={lbl}>{L('مستوى الصعوبة', 'Difficulty level')}</label><select value={edit.difficulty || ''} onChange={e => set('difficulty', e.target.value)} className={field}><option value="">—</option>{Object.keys(DIFFICULTY).map(d => <option key={d} value={d}>{isAr ? DIFFICULTY[d].ar : DIFFICULTY[d].en}</option>)}</select></div>
                                <div className="md:col-span-2"><label className={lbl}>{L('الترخيص وقيود الاستخدام التجاري', 'Licensing & commercial restrictions')}</label><textarea rows={2} value={edit.licensing || ''} onChange={e => set('licensing', e.target.value)} className={field} /></div>
                                <div className="md:col-span-2"><label className={lbl}>{L('تعليمات التثبيت / الاستخدام المحمول', 'Install / portable use')}</label><textarea rows={2} value={edit.install_instructions || ''} onChange={e => set('install_instructions', e.target.value)} className={field} /></div>
                                <div className="md:col-span-2"><label className={lbl}>{L('المراجعة الأمنية والقيود', 'Security review & limitations')}</label><input value={edit.security_review || ''} onChange={e => set('security_review', e.target.value)} className={field} /></div>
                                <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={!!edit.admin_required} onChange={e => set('admin_required', e.target.checked)} className="accent-[#DBA935] w-4 h-4" />{L('يتطلب صلاحية مدير', 'Admin required')}</label>
                            </>)}
                            {/* shared */}
                            <div><label className={lbl}>{L('المصدر / تاريخ التحقق', 'Source / verified on')}</label><input type="date" value={edit.verified_on || ''} onChange={e => set('verified_on', e.target.value)} className={field} /></div>
                            {tab === 'procedures' && <div><label className={lbl}>{L('المصدر الموثّق', 'Authoritative source')}</label><input value={edit.source || ''} onChange={e => set('source', e.target.value)} className={field} /></div>}
                            <div><label className={lbl}>{L('الحالة', 'Status')}</label>
                                <select value={edit.review_status || 'draft'} onChange={e => set('review_status', e.target.value)} className={field}>
                                    {Object.keys(STATUS).map(s => <option key={s} value={s} disabled={(s === 'approved' || s === 'suspended') && !canApprove}>{isAr ? STATUS[s].ar : STATUS[s].en}{(s === 'approved' || s === 'suspended') && !canApprove ? L(' (مدير فقط)', ' (manager only)') : ''}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-silver/20 sticky bottom-0 bg-[#1a1a1e]">
                            <button onClick={() => setEdit(null)} className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20">{L('إلغاء', 'Cancel')}</button>
                            <button onClick={save} className="px-4 py-2 rounded-lg bg-[#DBA935] text-[#3E3B3F] font-bold text-sm hover:bg-[#DBA935]/90">{L('حفظ', 'Save')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
