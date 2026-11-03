'use client';

// Research & Development board. Items flow across stages and link to the departments they
// feed — a project, a product, the technical survey that sparked them and an owner. Managers
// and R&D roles create and move items; everyone internal can follow the board.
import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';

const STAGE_LABEL: Record<string, [string, string]> = {
    idea: ['فكرة', 'Idea'], research: ['بحث', 'Research'], prototype: ['نموذج أولي', 'Prototype'],
    testing: ['اختبار', 'Testing'], review: ['مراجعة', 'Review'], done: ['مكتمل', 'Done'], rejected: ['مرفوض', 'Rejected'],
};
const CAT_LABEL: Record<string, [string, string]> = {
    product: ['منتج', 'Product'], service: ['خدمة', 'Service'], process: ['عملية', 'Process'],
    technology: ['تقنية', 'Technology'], research: ['بحث علمي', 'Research'],
};
const PRIO_LABEL: Record<string, [string, string]> = { high: ['عالية', 'High'], medium: ['متوسطة', 'Medium'], low: ['منخفضة', 'Low'] };
const PRIO_COLOR: Record<string, string> = { high: 'text-red-300 bg-red-500/15', medium: 'text-[#DBA935] bg-[#DBA935]/15', low: 'text-silver bg-white/10' };

export default function RndPage() {
    const locale = useLocale(); const isAr = locale === 'ar'; const L = (a: string, e: string) => (isAr ? a : e);
    const [data, setData] = useState<any | null>(null);
    const [err, setErr] = useState('');
    const [edit, setEdit] = useState<any | null>(null);

    const field = 'w-full bg-black/30 border border-[#DBA935]/20 rounded-lg px-3 py-2 text-sm text-white focus:border-[#DBA935]/60 outline-none';
    const lbl = 'block text-xs text-[#C0C0C0] mb-1';

    const load = useCallback(async () => {
        const res = await fetch('/api/rnd'); const j = await res.json();
        if (!res.ok) { setErr(j.error || 'Error'); return; }
        setData(j);
    }, []);
    useEffect(() => { load(); }, [load]);

    const save = async () => {
        if (!edit.title?.trim()) { setErr(L('العنوان مطلوب.', 'Title required.')); return; }
        const method = edit.id ? 'PATCH' : 'POST';
        const res = await fetch('/api/rnd', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit) });
        const j = await res.json(); if (!res.ok) { setErr(j.error); return; }
        setEdit(null); setErr(''); load();
    };
    const move = async (item: any, stage: string) => {
        await fetch('/api/rnd', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, stage }) });
        load();
    };
    const del = async (id: string) => { if (!confirm(L('حذف العنصر؟', 'Delete item?'))) return; await fetch(`/api/rnd?id=${id}`, { method: 'DELETE' }); load(); };

    if (err && !data) return <div className="min-h-screen flex items-center justify-center text-red-400" dir={isAr ? 'rtl' : 'ltr'}>{err}</div>;
    if (!data) return <div className="min-h-screen flex items-center justify-center text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</div>;

    const { items, stages, canManage, links } = data;
    const byStage = (s: string) => items.filter((i: any) => i.stage === s);

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="max-w-[1400px] mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">🔬 {L('البحث والتطوير', 'Research & Development')}</h1>
                        <p className="text-[#C0C0C0] text-sm mt-1">{L('من الفكرة إلى المنتج — مرتبطة بالمشاريع والمنتجات والمسح الفني.', 'From idea to product — linked to projects, products and technical surveys.')}</p>
                    </div>
                    {canManage && <button onClick={() => setEdit({ category: 'product', stage: 'idea', priority: 'medium', status: 'active', tags: [] })} className="px-4 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold text-sm">+ {L('عنصر جديد', 'New item')}</button>}
                </div>
                {err && <div className="mb-3 text-red-400 text-sm">{err}</div>}

                <div className="flex gap-3 overflow-x-auto pb-4">
                    {stages.map((s: string) => (
                        <div key={s} className="min-w-[260px] w-[260px] shrink-0 bg-black/30 rounded-2xl border border-[#DBA935]/15 p-3">
                            <div className="flex items-center justify-between mb-2 px-1">
                                <h3 className="text-[#DBA935] font-bold text-sm">{L(STAGE_LABEL[s]?.[0] || s, STAGE_LABEL[s]?.[1] || s)}</h3>
                                <span className="text-silver/50 text-xs">{byStage(s).length}</span>
                            </div>
                            <div className="space-y-2">
                                {byStage(s).map((i: any) => (
                                    <div key={i.id} className="bg-black/40 rounded-xl border border-white/10 p-3">
                                        <div className="flex items-start justify-between gap-1">
                                            <span className="text-white text-sm font-medium">{i.title}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${PRIO_COLOR[i.priority] || ''}`}>{L(PRIO_LABEL[i.priority]?.[0] || '', PRIO_LABEL[i.priority]?.[1] || '')}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-silver/60">
                                            <span className="px-1.5 py-0.5 rounded bg-white/5">{L(CAT_LABEL[i.category]?.[0] || i.category, CAT_LABEL[i.category]?.[1] || i.category)}</span>
                                            {i.owner_name && <span className="px-1.5 py-0.5 rounded bg-white/5">👤 {i.owner_name}</span>}
                                        </div>
                                        {(i.project_name || i.product_name) && (
                                            <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                                                {i.project_name && <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">📁 {i.project_name}</span>}
                                                {i.product_name && <span className="px-1.5 py-0.5 rounded bg-green-500/15 text-green-300">📦 {i.product_name}</span>}
                                            </div>
                                        )}
                                        {i.progress_pct > 0 && <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-2"><div className="h-full bg-[#DBA935]" style={{ width: `${i.progress_pct}%` }} /></div>}
                                        {canManage && (
                                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                                                <select value={i.stage} onChange={e => move(i, e.target.value)} className="bg-black/40 border border-white/10 rounded text-[10px] text-white px-1 py-0.5">
                                                    {stages.map((st: string) => <option key={st} value={st}>{L(STAGE_LABEL[st]?.[0] || st, STAGE_LABEL[st]?.[1] || st)}</option>)}
                                                </select>
                                                <button onClick={() => setEdit(i)} className="text-[#DBA935] text-xs px-1">✎</button>
                                                <button onClick={() => del(i.id)} className="text-red-300 text-xs px-1">✕</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {byStage(s).length === 0 && <p className="text-silver/30 text-xs px-1 py-2">—</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* editor */}
            {edit && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={() => setEdit(null)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 rounded-2xl shadow-2xl border border-[#DBA935]/30 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={ev => ev.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]"><h2 className="text-lg text-[#DBA935]">{edit.id ? L('تعديل عنصر', 'Edit item') : L('عنصر بحث وتطوير', 'R&D item')}</h2><button onClick={() => setEdit(null)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button></div>
                        <div className="p-4 space-y-3">
                            <div><label className={lbl}>{L('العنوان', 'Title')} *</label><input value={edit.title || ''} onChange={e => setEdit({ ...edit, title: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('الوصف', 'Description')}</label><textarea rows={3} value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })} className={field} /></div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div><label className={lbl}>{L('التصنيف', 'Category')}</label><select value={edit.category} onChange={e => setEdit({ ...edit, category: e.target.value })} className={field}>{Object.keys(CAT_LABEL).map(k => <option key={k} value={k}>{L(CAT_LABEL[k][0], CAT_LABEL[k][1])}</option>)}</select></div>
                                <div><label className={lbl}>{L('المرحلة', 'Stage')}</label><select value={edit.stage} onChange={e => setEdit({ ...edit, stage: e.target.value })} className={field}>{stages.map((k: string) => <option key={k} value={k}>{L(STAGE_LABEL[k]?.[0] || k, STAGE_LABEL[k]?.[1] || k)}</option>)}</select></div>
                                <div><label className={lbl}>{L('الأولوية', 'Priority')}</label><select value={edit.priority} onChange={e => setEdit({ ...edit, priority: e.target.value })} className={field}>{Object.keys(PRIO_LABEL).map(k => <option key={k} value={k}>{L(PRIO_LABEL[k][0], PRIO_LABEL[k][1])}</option>)}</select></div>
                            </div>
                            {/* links to other departments */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div><label className={lbl}>{L('المالك', 'Owner')}</label><select value={edit.owner_employee_id || ''} onChange={e => setEdit({ ...edit, owner_employee_id: e.target.value || null })} className={field}><option value="">—</option>{(links.employees || []).map((em: any) => <option key={em.EmployeeID} value={em.EmployeeID}>{em.Name}</option>)}</select></div>
                                <div><label className={lbl}>📁 {L('مشروع مرتبط', 'Linked project')}</label><select value={edit.project_id || ''} onChange={e => setEdit({ ...edit, project_id: e.target.value || null })} className={field}><option value="">—</option>{(links.projects || []).map((p: any) => <option key={p.ProjectID} value={p.ProjectID}>{p.ProjectName}</option>)}</select></div>
                                <div><label className={lbl}>📦 {L('منتج مرتبط', 'Linked product')}</label><select value={edit.product_id || ''} onChange={e => setEdit({ ...edit, product_id: e.target.value || null })} className={field}><option value="">—</option>{(links.products || []).map((p: any) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}</select></div>
                            </div>
                            <div><label className={lbl}>{L('المخرج المتوقع', 'Expected outcome')}</label><input value={edit.expected_outcome || ''} onChange={e => setEdit({ ...edit, expected_outcome: e.target.value })} className={field} /></div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div><label className={lbl}>{L('تقدير الميزانية', 'Budget estimate')}</label><input type="number" value={edit.budget_estimate ?? ''} onChange={e => setEdit({ ...edit, budget_estimate: e.target.value === '' ? null : Number(e.target.value) })} className={field} /></div>
                                <div><label className={lbl}>{L('نسبة الإنجاز %', 'Progress %')}</label><input type="number" min={0} max={100} value={edit.progress_pct ?? 0} onChange={e => setEdit({ ...edit, progress_pct: Number(e.target.value) })} className={field} /></div>
                                <div><label className={lbl}>{L('تاريخ الهدف', 'Target date')}</label><input type="date" value={edit.target_date || ''} onChange={e => setEdit({ ...edit, target_date: e.target.value || null })} className={field} /></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-silver/20 sticky bottom-0 bg-[#1a1a1e]"><button onClick={() => setEdit(null)} className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm">{L('إلغاء', 'Cancel')}</button><button onClick={save} className="px-4 py-2 rounded-lg bg-[#DBA935] text-[#3E3B3F] font-bold text-sm">{L('حفظ', 'Save')}</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}
