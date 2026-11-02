'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';

interface Dept { id: string; code: string | null; name_ar: string; name_en: string | null; parent_id: string | null; manager_employee_id: string | null; sort: number; active: boolean; }
interface Pos { id: string; title_ar: string; title_en: string | null; department_id: string | null; reports_to: string | null; level: number; holder_employee_id: string | null; sort: number; }

export default function OrgPage() {
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [tab, setTab] = useState<'depts' | 'chart'>('depts');
    const [depts, setDepts] = useState<Dept[]>([]);
    const [positions, setPositions] = useState<Pos[]>([]);
    const [emps, setEmps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [deptModal, setDeptModal] = useState<Partial<Dept> | null>(null);
    const [posModal, setPosModal] = useState<Partial<Pos> | null>(null);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: d }, { data: p }, { data: e }] = await Promise.all([
            supabase.from('departments').select('*').order('sort'),
            supabase.from('positions').select('*').order('level').order('sort'),
            supabase.from('employees').select('EmployeeID, Name').is('deleted_at', null).order('Name'),
        ]);
        setDepts((d as Dept[]) || []); setPositions((p as Pos[]) || []); setEmps(e || []);
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const empName = (id: string | null) => emps.find(e => e.EmployeeID === id)?.Name || '';
    const deptName = (id: string | null) => { const d = depts.find(x => x.id === id); return d ? (isAr ? d.name_ar : (d.name_en || d.name_ar)) : ''; };
    const dLabel = (d: Dept) => isAr ? d.name_ar : (d.name_en || d.name_ar);

    const mains = useMemo(() => depts.filter(d => !d.parent_id), [depts]);
    const subsOf = (id: string) => depts.filter(d => d.parent_id === id);

    // org chart tree from positions (reports_to)
    const roots = useMemo(() => positions.filter(p => !p.reports_to), [positions]);
    const childrenOf = (id: string) => positions.filter(p => p.reports_to === id);

    const saveDept = async () => {
        const d = deptModal!; if (!d.name_ar?.trim()) return;
        setSaving(true);
        const payload: any = { name_ar: d.name_ar.trim(), name_en: d.name_en || null, parent_id: d.parent_id || null, manager_employee_id: d.manager_employee_id || null, active: d.active ?? true, updated_at: new Date().toISOString() };
        const { error } = d.id ? await supabase.from('departments').update(payload).eq('id', d.id)
            : await supabase.from('departments').insert([{ ...payload, sort: depts.length }]);
        setSaving(false); if (error) { alert(error.message); return; }
        setDeptModal(null); load();
    };
    const delDept = async (id: string) => { if (!confirm(L('حذف الإدارة؟ (الأقسام الفرعية تبقى بدون أب)', 'Delete department?'))) return; await supabase.from('departments').delete().eq('id', id); load(); };

    const savePos = async () => {
        const p = posModal!; if (!p.title_ar?.trim()) return;
        setSaving(true);
        const payload: any = { title_ar: p.title_ar.trim(), title_en: p.title_en || null, department_id: p.department_id || null, reports_to: p.reports_to || null, level: p.level || 1, holder_employee_id: p.holder_employee_id || null, updated_at: new Date().toISOString() };
        const { error } = p.id ? await supabase.from('positions').update(payload).eq('id', p.id)
            : await supabase.from('positions').insert([{ ...payload, sort: positions.length }]);
        setSaving(false); if (error) { alert(error.message); return; }
        setPosModal(null); load();
    };
    const delPos = async (id: string) => { if (!confirm(L('حذف المنصب؟', 'Delete position?'))) return; await supabase.from('positions').delete().eq('id', id); load(); };

    const field = 'w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white text-sm focus:outline-none focus:border-gold';
    const lbl = 'block text-silver mb-1 text-xs';

    const PosNode = ({ p, depth }: { p: Pos; depth: number }) => (
        <div>
            <div className="flex items-center gap-2 py-1" style={{ paddingInlineStart: `${depth * 22}px` }}>
                {depth > 0 && <span className="text-gold/40">└</span>}
                <button onClick={() => setPosModal(p)} className="text-start group">
                    <span className="text-white text-sm group-hover:text-gold">{isAr ? p.title_ar : (p.title_en || p.title_ar)}</span>
                    <span className="text-[#C0C0C0]/60 text-xs"> — {deptName(p.department_id)}</span>
                    {p.holder_employee_id ? <span className="ms-2 text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">{empName(p.holder_employee_id)}</span>
                        : <span className="ms-2 text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400">{L('شاغر', 'Vacant')}</span>}
                </button>
            </div>
            {childrenOf(p.id).map(c => <PosNode key={c.id} p={c} depth={depth + 1} />)}
        </div>
    );

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-5xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <h1 className="text-2xl font-bold text-[#DBA935]">{L('الهيكل التنظيمي', 'Organization')}</h1>
                    {tab === 'depts'
                        ? <button onClick={() => setDeptModal({ active: true })} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm">{L('+ إدارة/قسم', '+ Department')}</button>
                        : <button onClick={() => setPosModal({ level: 2 })} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm">{L('+ منصب', '+ Position')}</button>}
                </div>

                <div className="flex gap-2 mb-4">
                    {([['depts', L('الإدارات والأقسام', 'Departments')], ['chart', L('المناصب والخريطة', 'Positions & Chart')]] as const).map(([k, lab]) => (
                        <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === k ? 'bg-[#DBA935] text-[#3E3B3F]' : 'bg-white/5 text-[#C0C0C0] hover:bg-white/10'}`}>{lab}</button>
                    ))}
                </div>

                {loading ? <div className="text-center py-10 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</div> : tab === 'depts' ? (
                    <div className="space-y-2">
                        {mains.length === 0 ? <p className="text-[#C0C0C0] text-sm">{L('لا توجد إدارات', 'No departments')}</p> : mains.map(m => (
                            <div key={m.id} className="rounded-xl border border-[#3E3B3F] p-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[#DBA935] font-semibold">{dLabel(m)}{m.manager_employee_id ? <span className="text-[#C0C0C0]/60 text-xs font-normal"> — {L('المدير', 'Mgr')}: {empName(m.manager_employee_id)}</span> : ''}</span>
                                    <span className="inline-flex gap-3 text-xs">
                                        <button onClick={() => setDeptModal(m)} className="text-[#DBA935] hover:underline">{L('تعديل', 'Edit')}</button>
                                        <button onClick={() => delDept(m.id)} className="text-red-400 hover:underline">{L('حذف', 'Delete')}</button>
                                    </span>
                                </div>
                                {subsOf(m.id).length > 0 && (
                                    <div className="mt-2 ps-4 space-y-1">
                                        {subsOf(m.id).map(s => (
                                            <div key={s.id} className="flex justify-between items-center text-sm">
                                                <span className="text-white">↳ {dLabel(s)}</span>
                                                <span className="inline-flex gap-3 text-xs">
                                                    <button onClick={() => setDeptModal(s)} className="text-[#DBA935] hover:underline">{L('تعديل', 'Edit')}</button>
                                                    <button onClick={() => delDept(s.id)} className="text-red-400 hover:underline">{L('حذف', 'Delete')}</button>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border border-[#3E3B3F] p-4">
                        <p className="text-[#C0C0C0]/60 text-xs mb-3">{L('الخريطة تعرض المناصب وخطوط التبعية (المنصب الشاغر يظهر «شاغر»). اضغط منصب لتعديله.', 'Chart shows positions & reporting (vacant marked). Click a position to edit.')}</p>
                        {roots.length === 0 ? <p className="text-[#C0C0C0] text-sm">{L('لا توجد مناصب', 'No positions')}</p> : roots.map(r => <PosNode key={r.id} p={r} depth={0} />)}
                    </div>
                )}
            </div>

            {/* Department modal */}
            {deptModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={() => setDeptModal(null)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 rounded-2xl shadow-2xl border border-gold/30 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-silver/20"><h2 className="text-lg font-alata text-gold">{deptModal.id ? L('تعديل إدارة', 'Edit department') : L('إدارة/قسم جديد', 'New department')}</h2><button onClick={() => setDeptModal(null)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button></div>
                        <div className="p-5 space-y-3">
                            <div><label className={lbl}>{L('الاسم (عربي)', 'Name (Arabic)')} *</label><input value={deptModal.name_ar || ''} onChange={e => setDeptModal({ ...deptModal, name_ar: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('الاسم (إنجليزي)', 'Name (English)')}</label><input value={deptModal.name_en || ''} onChange={e => setDeptModal({ ...deptModal, name_en: e.target.value })} className={field} dir="ltr" /></div>
                            <div><label className={lbl}>{L('الإدارة الأم (اتركه فارغاً لإدارة رئيسية)', 'Parent (empty = main)')}</label>
                                <select value={deptModal.parent_id || ''} onChange={e => setDeptModal({ ...deptModal, parent_id: e.target.value || null })} className={field}>
                                    <option value="">{L('— رئيسية —', '— main —')}</option>
                                    {mains.filter(m => m.id !== deptModal.id).map(m => <option key={m.id} value={m.id}>{dLabel(m)}</option>)}
                                </select>
                            </div>
                            <div><label className={lbl}>{L('مدير الإدارة', 'Manager')}</label>
                                <select value={deptModal.manager_employee_id || ''} onChange={e => setDeptModal({ ...deptModal, manager_employee_id: e.target.value || null })} className={field}>
                                    <option value="">{L('— بدون —', '— none —')}</option>
                                    {emps.map(e => <option key={e.EmployeeID} value={e.EmployeeID}>{e.Name}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-1"><button onClick={saveDept} disabled={saving} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold hover:bg-yellow-600 disabled:opacity-50">{saving ? '...' : L('حفظ', 'Save')}</button><button onClick={() => setDeptModal(null)} className="px-4 py-2 bg-silver/10 rounded-lg text-silver hover:bg-silver/20">{L('إلغاء', 'Cancel')}</button></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Position modal */}
            {posModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={() => setPosModal(null)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 rounded-2xl shadow-2xl border border-gold/30 w-full max-w-md max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-silver/20"><h2 className="text-lg font-alata text-gold">{posModal.id ? L('تعديل منصب', 'Edit position') : L('منصب جديد', 'New position')}</h2><button onClick={() => setPosModal(null)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button></div>
                        <div className="p-5 space-y-3">
                            <div><label className={lbl}>{L('المسمى (عربي)', 'Title (Arabic)')} *</label><input value={posModal.title_ar || ''} onChange={e => setPosModal({ ...posModal, title_ar: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('المسمى (إنجليزي)', 'Title (English)')}</label><input value={posModal.title_en || ''} onChange={e => setPosModal({ ...posModal, title_en: e.target.value })} className={field} dir="ltr" /></div>
                            <div><label className={lbl}>{L('الإدارة', 'Department')}</label>
                                <select value={posModal.department_id || ''} onChange={e => setPosModal({ ...posModal, department_id: e.target.value || null })} className={field}>
                                    <option value="">{L('— اختر —', '— select —')}</option>
                                    {depts.map(d => <option key={d.id} value={d.id}>{dLabel(d)}{d.parent_id ? ` (${deptName(d.parent_id)})` : ''}</option>)}
                                </select>
                            </div>
                            <div><label className={lbl}>{L('يرفع تقاريره إلى', 'Reports to')}</label>
                                <select value={posModal.reports_to || ''} onChange={e => setPosModal({ ...posModal, reports_to: e.target.value || null })} className={field}>
                                    <option value="">{L('— أعلى الهرم —', '— top —')}</option>
                                    {positions.filter(p => p.id !== posModal.id).map(p => <option key={p.id} value={p.id}>{isAr ? p.title_ar : (p.title_en || p.title_ar)}</option>)}
                                </select>
                            </div>
                            <div><label className={lbl}>{L('شاغل المنصب (اتركه فارغاً = شاغر)', 'Holder (empty = vacant)')}</label>
                                <select value={posModal.holder_employee_id || ''} onChange={e => setPosModal({ ...posModal, holder_employee_id: e.target.value || null })} className={field}>
                                    <option value="">{L('— شاغر —', '— vacant —')}</option>
                                    {emps.map(e => <option key={e.EmployeeID} value={e.EmployeeID}>{e.Name}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button onClick={savePos} disabled={saving} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold hover:bg-yellow-600 disabled:opacity-50">{saving ? '...' : L('حفظ', 'Save')}</button>
                                {posModal.id && <button onClick={() => { delPos(posModal.id!); setPosModal(null); }} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">{L('حذف', 'Delete')}</button>}
                                <button onClick={() => setPosModal(null)} className="px-4 py-2 bg-silver/10 rounded-lg text-silver hover:bg-silver/20">{L('إلغاء', 'Cancel')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
