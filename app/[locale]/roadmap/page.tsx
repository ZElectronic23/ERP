'use client';

// Development roadmap — mandatory vs optional training, workload-aware. Employees see and start
// their plan; managers assign items (linked to a course or free-text), pull recommendations from
// the latest evaluation, and sync a summary into the development plan that evaluations read.
import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';

const STATUS: Record<string, { ar: string; en: string; cls: string }> = {
    planned: { ar: 'مخطط', en: 'Planned', cls: 'bg-white/10 text-silver' },
    in_progress: { ar: 'جارٍ', en: 'In progress', cls: 'bg-sky-500/20 text-sky-300' },
    completed: { ar: 'مكتمل', en: 'Completed', cls: 'bg-green-500/20 text-green-300' },
    waived: { ar: 'معفى', en: 'Waived', cls: 'bg-orange-500/20 text-orange-300' },
};

export default function RoadmapPage() {
    const locale = useLocale(); const isAr = locale === 'ar'; const L = (a: string, e: string) => (isAr ? a : e);
    const [data, setData] = useState<any | null>(null);
    const [viewId, setViewId] = useState<string | null>(null);
    const [emps, setEmps] = useState<any[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);
    const [add, setAdd] = useState<any>({ course_id: '', title: '', requirement: 'mandatory', reason: '', responsibility: '', target_date: '' });

    const field = 'bg-black/30 border border-[#DBA935]/20 rounded-lg px-3 py-2 text-sm text-white focus:border-[#DBA935]/60 outline-none';

    const load = useCallback(async (empId?: string | null) => {
        setLoading(true); setErr('');
        try { const res = await fetch(`/api/roadmap${empId ? `?employee_id=${empId}` : ''}`); const j = await res.json(); if (!res.ok) throw new Error(j.message || j.error); setData(j); }
        catch (e: any) { setErr(e.message); }
        setLoading(false);
    }, []);
    useEffect(() => { load(null); }, [load]);
    useEffect(() => {
        supabase.from('employees').select('id:EmployeeID, name:Name').is('deleted_at', null).order('Name').then(({ data }) => setEmps((data as any) || []));
        supabase.from('courses').select('id, title_ar, title_en').is('deleted_at', null).eq('status', 'published').order('title_ar').then(({ data }) => setCourses((data as any) || []));
    }, []);

    const canAssign = !!data?.canAssign;
    const post = async (body: any) => { const r = await fetch('/api/roadmap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) { setErr(j.message || j.error); return null; } return j; };
    const refresh = () => load(viewId);
    const target = viewId || data?.employee?.EmployeeID;

    const addItem = async () => {
        if (!target) { setErr(L('اختر موظفاً أولاً.', 'Pick an employee first.')); return; }
        if (!add.course_id && !add.title.trim()) { setErr(L('اختر كورساً أو اكتب عنواناً.', 'Pick a course or type a title.')); return; }
        await post({ action: 'add', employee_id: target, ...add }); setAdd({ course_id: '', title: '', requirement: 'mandatory', reason: '', responsibility: '', target_date: '' }); refresh();
    };
    const fromEval = async () => { const j = await post({ action: 'from_evaluation', employee_id: target }); if (j) { alert(j.message || L(`أُضيف ${j.added} بند من التقييم.`, `Added ${j.added} item from evaluation.`)); refresh(); } };
    const syncPlan = async () => { const j = await post({ action: 'sync_development_plan', employee_id: target }); if (j) alert(j.summary || L('تم التحديث.', 'Updated.')); };
    const setStatus = async (id: string, status: string) => { await fetch('/api/roadmap', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id, status }) }); refresh(); };
    const del = async (id: string) => { await fetch(`/api/roadmap?id=${id}`, { method: 'DELETE' }); refresh(); };

    const openEmp = (id: string) => { setViewId(id); load(id); };

    const Item = ({ it }: { it: any }) => {
        const title = it.course ? (isAr ? it.course.title_ar : (it.course.title_en || it.course.title_ar)) : it.title;
        const st = it.effective_status;
        return (
            <div className="bg-black/30 rounded-xl border border-white/10 p-3">
                <div className="flex flex-wrap justify-between items-start gap-2">
                    <div>
                        <span className="text-white text-sm font-bold">{title}</span>
                        {it.course && <span className="text-[11px] text-[#DBA935] ms-2">🎓 {L('كورس', 'course')}</span>}
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ms-2 ${STATUS[st]?.cls}`}>{isAr ? STATUS[st]?.ar : STATUS[st]?.en}</span>
                        {it.target_date && <span className="text-silver/50 text-[11px] ms-2">⏳ {it.target_date}</span>}
                        {it.reason && <div className="text-[#C0C0C0] text-[11px] mt-0.5">{it.reason}</div>}
                        {it.responsibility && <div className="text-silver/50 text-[11px]">🔗 {it.responsibility}</div>}
                        {it.enrollment && <div className="mt-1 h-1.5 w-40 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-[#DBA935]" style={{ width: `${it.enrollment.progress_pct || 0}%` }} /></div>}
                    </div>
                    <div className="flex items-center gap-1">
                        {st !== 'completed' && st !== 'waived' && st !== 'in_progress' && <button onClick={() => setStatus(it.id, 'in_progress')} className="text-[11px] px-2 py-1 rounded-lg bg-sky-600/70 text-white">{L('ابدأ', 'Start')}</button>}
                        {canAssign && st !== 'completed' && <button onClick={() => setStatus(it.id, 'completed')} className="text-[11px] px-2 py-1 rounded-lg bg-green-600/70 text-white">{L('اكتمل', 'Done')}</button>}
                        {canAssign && st !== 'waived' && it.requirement === 'optional' && <button onClick={() => setStatus(it.id, 'waived')} className="text-[11px] px-2 py-1 rounded-lg bg-white/10 text-silver">{L('إعفاء', 'Waive')}</button>}
                        {canAssign && <button onClick={() => del(it.id)} className="text-red-300 text-[11px]">✕</button>}
                    </div>
                </div>
            </div>
        );
    };

    const mandatory = (data?.items || []).filter((i: any) => i.requirement === 'mandatory');
    const optional = (data?.items || []).filter((i: any) => i.requirement === 'optional');

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-5xl mx-auto">
                <h1 className="text-2xl font-bold text-[#DBA935]">{L('مسار التطوير', 'Development Roadmap')}</h1>
                <p className="text-[#C0C0C0] text-sm mt-1 mb-4">{L('تدريب إلزامي واختياري مرتبط بمسؤولياتك — مع مراعاة عبء العمل، ويغذّي خطة التطوير والتقييم.', 'Mandatory & optional training tied to your responsibilities — workload-aware, feeding your development plan and evaluation.')}</p>

                {err && <div className="mb-3 text-red-400 text-sm">{err}</div>}

                {/* manager: employee picker */}
                {canAssign && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="text-xs text-[#C0C0C0]">{L('موظف:', 'Employee:')}</span>
                        <select value={viewId || ''} onChange={e => openEmp(e.target.value)} className={field}>
                            <option value="">{L('— اختر —', '— Select —')}</option>
                            {emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                )}

                {loading ? <div className="text-center py-16 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</div>
                    : !data?.employee && !canAssign ? <div className="text-center py-16 text-[#C0C0C0] text-sm">{L('لا يوجد ملف موظف مرتبط بحسابك.', 'No employee linked to your account.')}</div>
                        : !data?.employee && canAssign ? <div className="text-center py-10 text-[#C0C0C0] text-sm">{L('اختر موظفاً لعرض وإسناد مساره.', 'Pick an employee to view and assign their roadmap.')}</div>
                            : (<div className="space-y-5">
                                {/* header + workload + metrics */}
                                <div className="bg-black/30 rounded-xl border border-white/10 p-4 flex flex-wrap justify-between gap-3">
                                    <div><h2 className="text-white font-bold">{data.employee.Name}</h2><p className="text-[#C0C0C0] text-xs">{data.employee.Position || '—'} · {data.employee.Department || '—'}</p></div>
                                    <div className="text-xs text-[#C0C0C0] text-end space-y-0.5">
                                        {data.metrics.completion != null && <div>{L('الإلزامي المكتمل', 'Mandatory done')}: <b className="text-green-300">{data.metrics.mandatoryDone}/{data.metrics.mandatoryTotal}</b> ({data.metrics.completion}%)</div>}
                                        <div className={data.workload.overloaded ? 'text-red-300' : ''}>{L('العبء الحالي', 'Current load')}: {data.workload.openTasks} {L('مهمة', 'tasks')} + {data.workload.activeMandatory} {L('تدريب إلزامي نشط', 'active mandatory')}{data.workload.overloaded ? ` ⚠ ${L('عبء مرتفع', 'high load')}` : ''}</div>
                                    </div>
                                </div>

                                {data.workload.overloaded && canAssign && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-200 text-xs">{L('تنبيه: عبء العمل مرتفع — فكّر في جدولة التدريب لاحقاً أو جعله اختيارياً حتى لا يرهق الموظف.', 'Warning: high workload — consider scheduling training later or marking it optional to avoid overloading this employee.')}</div>}

                                {/* mandatory */}
                                <div>
                                    <h3 className="text-[#DBA935] font-bold mb-2">{L('تدريب إلزامي', 'Mandatory training')} ({mandatory.length})</h3>
                                    {mandatory.length === 0 ? <p className="text-silver/50 text-sm">{L('لا بنود إلزامية.', 'None.')}</p> : <div className="space-y-2">{mandatory.map((i: any) => <Item key={i.id} it={i} />)}</div>}
                                </div>
                                {/* optional */}
                                <div>
                                    <h3 className="text-[#DBA935] font-bold mb-2">{L('تدريب اختياري', 'Optional training')} ({optional.length})</h3>
                                    {optional.length === 0 ? <p className="text-silver/50 text-sm">{L('لا بنود اختيارية.', 'None.')}</p> : <div className="space-y-2">{optional.map((i: any) => <Item key={i.id} it={i} />)}</div>}
                                </div>

                                {/* manager: assign */}
                                {canAssign && target && (
                                    <div className="bg-black/30 rounded-xl border border-[#DBA935]/20 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                            <h3 className="text-[#DBA935] font-bold">{L('إسناد تدريب', 'Assign training')}</h3>
                                            <div className="flex gap-2">
                                                <button onClick={fromEval} className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20">↙ {L('من التقييم', 'From evaluation')}</button>
                                                <button onClick={syncPlan} className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20">↻ {L('تحديث خطة التطوير', 'Sync development plan')}</button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <select value={add.course_id} onChange={e => setAdd({ ...add, course_id: e.target.value })} className={field}><option value="">{L('— كورس (اختياري) —', '— Course (optional) —')}</option>{courses.map(c => <option key={c.id} value={c.id}>{isAr ? c.title_ar : (c.title_en || c.title_ar)}</option>)}</select>
                                            <input value={add.title} onChange={e => setAdd({ ...add, title: e.target.value })} placeholder={L('أو عنوان تدريب حر', 'or free-text training title')} className={field} />
                                            <select value={add.requirement} onChange={e => setAdd({ ...add, requirement: e.target.value })} className={field}><option value="mandatory">{L('إلزامي', 'Mandatory')}</option><option value="optional">{L('اختياري', 'Optional')}</option></select>
                                            <input type="date" value={add.target_date} onChange={e => setAdd({ ...add, target_date: e.target.value })} className={field} />
                                            <input value={add.responsibility} onChange={e => setAdd({ ...add, responsibility: e.target.value })} placeholder={L('مرتبط بمسؤولية', 'Linked responsibility')} className={field} />
                                            <input value={add.reason} onChange={e => setAdd({ ...add, reason: e.target.value })} placeholder={L('السبب', 'Reason')} className={field} />
                                        </div>
                                        <button onClick={addItem} className="mt-2 px-4 py-2 rounded-lg bg-[#DBA935] text-[#3E3B3F] font-bold text-sm">{L('إسناد', 'Assign')}</button>
                                    </div>
                                )}
                            </div>)}
            </div>
        </div>
    );
}
