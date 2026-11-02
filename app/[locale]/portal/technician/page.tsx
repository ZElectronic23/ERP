'use client';

// Technician / engineer self-service portal. Everything shown is the signed-in employee's OWN
// data (scoped server-side in /api/portal/technician): projects, tasks (with status update),
// a month calendar of his visits/maintenance/assignments, his requests, custody, evaluation +
// recommended trainings, attendance, and a quick new leave request. Reduces load on HR.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import FingerprintPunch from '@/components/attendance/FingerprintPunch';
import FaultAssistant from '@/components/support/FaultAssistant';

type Tab = 'projects' | 'tasks' | 'calendar' | 'requests' | 'custody' | 'evaluation' | 'fault';

const TASK_STATUS: Record<string, { ar: string; en: string; cls: string }> = {
    todo: { ar: 'لم تبدأ', en: 'To do', cls: 'bg-silver/15 text-silver' },
    in_progress: { ar: 'جارية', en: 'In progress', cls: 'bg-yellow-500/20 text-yellow-300' },
    review: { ar: 'مراجعة', en: 'Review', cls: 'bg-blue-500/20 text-blue-300' },
    done: { ar: 'مكتملة', en: 'Done', cls: 'bg-green-500/20 text-green-300' },
};

export default function TechnicianPortal() {
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [tab, setTab] = useState<Tab>('tasks');
    const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const [leave, setLeave] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
    const [leaveMsg, setLeaveMsg] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true); setErr('');
        try {
            const res = await fetch('/api/portal/technician');
            const j = await res.json();
            if (!res.ok) { setErr(j.message || j.error || 'Error'); setData(null); return; }
            setData(j);
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const setTaskStatus = async (taskId: string, status: string) => {
        await fetch('/api/portal/technician', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, status }) });
        load();
    };
    const submitLeave = async () => {
        if (!leave.start_date || !leave.end_date) { setLeaveMsg(L('أدخل التواريخ', 'Enter dates')); return; }
        setBusy(true); setLeaveMsg('');
        const res = await fetch('/api/portal/technician', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'leave', ...leave }) });
        const j = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) { setLeaveMsg(j.error || 'Error'); return; }
        setLeave({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
        setLeaveMsg(L('تم إرسال الطلب ✓', 'Request submitted ✓')); load();
    };

    // month calendar cells
    const cal = useMemo(() => {
        const y = month.getFullYear(), m = month.getMonth();
        const first = new Date(y, m, 1); const startDow = first.getDay();
        const days = new Date(y, m + 1, 0).getDate();
        const byDay: Record<number, any[]> = {};
        (data?.calendar || []).forEach((e: any) => {
            const d = e.start || e.end; if (!d) return;
            const dt = new Date(d);
            if (dt.getFullYear() === y && dt.getMonth() === m) (byDay[dt.getDate()] ||= []).push(e);
        });
        const cells: ({ day: number; events: any[] } | null)[] = [];
        for (let i = 0; i < startDow; i++) cells.push(null);
        for (let d = 1; d <= days; d++) cells.push({ day: d, events: byDay[d] || [] });
        return cells;
    }, [month, data]);

    const fmt = (s?: string | null) => (s ? new Date(s).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—');
    const fmtD = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : '—');
    const card = 'rounded-xl border border-silver/20 bg-[#1a1a1e] p-4';
    const monthName = month.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gold" dir={isAr ? 'rtl' : 'ltr'}>{L('جارٍ التحميل...', 'Loading...')}</div>;
    if (err || !data) return <div className="min-h-screen flex items-center justify-center text-silver p-6 text-center" dir={isAr ? 'rtl' : 'ltr'}>{err || L('لا توجد بيانات', 'No data')}</div>;

    const TABS: [Tab, string][] = [
        ['tasks', L('مهامي', 'My tasks')], ['calendar', L('الكالندر', 'Calendar')], ['projects', L('مشاريعي', 'My projects')],
        ['requests', L('طلباتي', 'My requests')], ['custody', L('عهدتي', 'Custody')], ['evaluation', L('تقييمي وتدريباتي', 'Evaluation & training')],
        ['fault', L('مساعد الأعطال', 'Fault assistant')],
    ];

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="max-w-5xl mx-auto space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-alata text-gold">{L('بوابة الفني/المهندس', 'Technician portal')}</h1>
                        <p className="text-silver/70 text-sm">{data.employee.name}{data.employee.department ? ` · ${data.employee.department}` : ''} · {L('رصيد الإجازات', 'Leave balance')}: {data.employee.leaveBalance ?? 0}</p>
                        <p className="text-silver/50 text-xs mt-1 max-w-2xl">{L('هذه مساحتك الشخصية: تتابع فيها مهامك ومواعيدك ومشاريعك وطلباتك وعهدتك وتقييمك وحضورك — كلها خاصة بك وحدك. استخدم الأقسام بالأعلى، وزر ℹ️ أعلى الواتساب يشرح أي صفحة.', 'This is your personal space: your tasks, schedule, projects, requests, custody, evaluation and attendance — all private to you. Use the sections above; the ℹ️ button (above WhatsApp) explains any page.')}</p>
                    </div>
                </div>

                <FingerprintPunch />

                <div className="flex gap-2 flex-wrap">
                    {TABS.map(([k, lbl]) => (
                        <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${tab === k ? 'bg-gold text-darkwhite' : 'bg-silver/10 text-silver hover:bg-silver/20'}`}>{lbl}</button>
                    ))}
                </div>

                {tab === 'tasks' && (
                    <div className="space-y-2">
                        {data.tasks.length === 0 && <p className="text-silver/50 text-sm">{L('لا توجد مهام موكلة إليك.', 'No tasks assigned to you.')}</p>}
                        {data.tasks.map((t: any) => (
                            <div key={t.TaskID} className={`${card} flex items-center justify-between gap-3 flex-wrap`}>
                                <div>
                                    <div className="text-silver text-sm font-bold">{t.TaskName} <span className="text-silver/40 text-xs">· {t.TaskID}{t.ProjectID ? ` · ${t.ProjectID}` : ''}</span></div>
                                    <div className="text-silver/50 text-xs mt-1">{t.StartDate ? `${fmtD(t.StartDate)} → ${fmtD(t.EndDate)}` : ''}{t.TaskPriority ? ` · ${t.TaskPriority}` : ''}</div>
                                </div>
                                <select value={t.Status || 'todo'} onChange={e => setTaskStatus(t.TaskID, e.target.value)} className="px-2 py-1 bg-[#0a0a0c] border border-silver/30 rounded text-silver text-xs focus:outline-none focus:border-gold">
                                    {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{isAr ? v.ar : v.en}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'calendar' && (
                    <div className={card}>
                        <div className="flex items-center justify-between mb-3">
                            <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="px-2 py-1 rounded bg-silver/10 text-silver text-sm hover:bg-silver/20">‹</button>
                            <span className="text-gold font-bold text-sm">{monthName}</span>
                            <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="px-2 py-1 rounded bg-silver/10 text-silver text-sm hover:bg-silver/20">›</button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-silver/50 mb-1">
                            {(isAr ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map(d => <div key={d}>{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {cal.map((c, i) => (
                                <div key={i} className={`min-h-[52px] rounded border p-1 text-start ${c ? 'border-silver/15 bg-[#0a0a0c]' : 'border-transparent'}`}>
                                    {c && <>
                                        <div className="text-[10px] text-silver/50">{c.day}</div>
                                        {c.events.slice(0, 3).map((e: any) => (
                                            <div key={e.id} title={e.title} className="truncate text-[9px] px-1 py-0.5 mt-0.5 rounded bg-gold/20 text-gold">{e.title}</div>
                                        ))}
                                        {c.events.length > 3 && <div className="text-[9px] text-silver/40">+{c.events.length - 3}</div>}
                                    </>}
                                </div>
                            ))}
                        </div>
                        <p className="text-silver/40 text-[11px] mt-2">{L('المواعيد مُشتقّة من مهامك ذات التواريخ (زيارات/صيانات/أعمال).', 'Events are derived from your dated tasks (visits/maintenance/work).')}</p>
                    </div>
                )}

                {tab === 'projects' && (
                    <div className="space-y-2">
                        {data.projects.length === 0 && <p className="text-silver/50 text-sm">{L('لا توجد مشاريع مرتبطة بك.', 'No projects linked to you.')}</p>}
                        {data.projects.map((p: any) => (
                            <a key={p.ProjectCode} href={`/${locale}/projects/${p.ProjectCode}`} className={`${card} block hover:border-gold/40`}>
                                <div className="text-gold text-sm font-bold">{p.ProjectCode} — {p.ProjectName}</div>
                                <div className="text-silver/50 text-xs mt-1">{L('الحالة', 'Status')}: {p.Status || '—'}{p.journey_stage ? ` · ${p.journey_stage}` : ''}</div>
                            </a>
                        ))}
                    </div>
                )}

                {tab === 'requests' && (
                    <div className="space-y-4">
                        <div className={card}>
                            <h3 className="text-gold text-sm font-bold mb-2">{L('طلب جديد (إجازة)', 'New request (leave)')}</h3>
                            <div className="grid sm:grid-cols-4 gap-2">
                                <select value={leave.leave_type} onChange={e => setLeave({ ...leave, leave_type: e.target.value })} className="px-2 py-2 bg-[#0a0a0c] border border-silver/30 rounded text-silver text-sm">
                                    <option value="annual">{L('سنوية', 'Annual')}</option><option value="sick">{L('مرضية', 'Sick')}</option>
                                    <option value="unpaid">{L('بدون راتب', 'Unpaid')}</option><option value="emergency">{L('طارئة', 'Emergency')}</option>
                                </select>
                                <input type="date" value={leave.start_date} onChange={e => setLeave({ ...leave, start_date: e.target.value })} className="px-2 py-2 bg-[#0a0a0c] border border-silver/30 rounded text-silver text-sm" />
                                <input type="date" value={leave.end_date} onChange={e => setLeave({ ...leave, end_date: e.target.value })} className="px-2 py-2 bg-[#0a0a0c] border border-silver/30 rounded text-silver text-sm" />
                                <button onClick={submitLeave} disabled={busy} className="px-3 py-2 bg-gold text-darkwhite rounded font-bold text-sm hover:bg-yellow-600 disabled:opacity-50">{L('إرسال', 'Submit')}</button>
                            </div>
                            <input value={leave.reason} onChange={e => setLeave({ ...leave, reason: e.target.value })} placeholder={L('السبب (اختياري)', 'Reason (optional)')} className="mt-2 w-full px-2 py-2 bg-[#0a0a0c] border border-silver/30 rounded text-silver text-sm" />
                            {leaveMsg && <p className="text-xs text-gold mt-2">{leaveMsg}</p>}
                        </div>
                        <div className={card}>
                            <h3 className="text-gold text-sm font-bold mb-2">{L('إجازاتي', 'My leaves')}</h3>
                            {data.requests.leaves.length === 0 ? <p className="text-silver/40 text-xs">{L('لا يوجد', 'None')}</p> :
                                data.requests.leaves.map((lv: any) => (
                                    <div key={lv.id} className="flex justify-between text-xs text-silver/80 py-1 border-b border-silver/10 last:border-0">
                                        <span>{lv.leave_type} · {fmtD(lv.start_date)} → {fmtD(lv.end_date)} ({lv.days}{L('ي', 'd')})</span>
                                        <span className="text-silver/50">{lv.status}</span>
                                    </div>
                                ))}
                        </div>
                        {data.requests.procurements.length > 0 && (
                            <div className={card}>
                                <h3 className="text-gold text-sm font-bold mb-2">{L('طلبات الشراء/العهدة', 'Procurement/custody requests')}</h3>
                                {data.requests.procurements.map((p: any) => (
                                    <div key={p.id} className="flex justify-between text-xs text-silver/80 py-1 border-b border-silver/10 last:border-0">
                                        <span>{p.item} ×{p.quantity} · {p.kind}</span><span className="text-silver/50">{p.status}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'custody' && (
                    <div className="space-y-2">
                        {data.custody.length === 0 && <p className="text-silver/50 text-sm">{L('لا توجد عهدة مسجّلة باسمك.', 'No custody recorded for you.')}</p>}
                        {data.custody.map((c: any) => (
                            <div key={c.id} className={`${card} flex justify-between items-center`}>
                                <div className="text-silver text-sm">{c.item} <span className="text-silver/40 text-xs">×{c.quantity}{c.project_code ? ` · ${c.project_code}` : ''}</span></div>
                                <span className="text-xs text-silver/50">{c.status}</span>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'fault' && <FaultAssistant />}

                {tab === 'evaluation' && (
                    <div className="space-y-3">
                        <div className={card}>
                            <h3 className="text-gold text-sm font-bold mb-2">{L('تقييماتي', 'My evaluations')}</h3>
                            {data.evaluations.legacy.length === 0 && data.evaluations.scored.length === 0 && <p className="text-silver/40 text-xs">{L('لا توجد تقييمات بعد.', 'No evaluations yet.')}</p>}
                            {data.evaluations.legacy.map((e: any) => (
                                <div key={e.EvaluationID} className="text-xs text-silver/80 py-1 border-b border-silver/10 last:border-0">
                                    {fmtD(e.Date)} · {e.EvaluationType || '—'} · <span className="text-gold">{e.Score}/{e.MaxScore}</span>{e.Notes ? ` · ${e.Notes}` : ''}
                                </div>
                            ))}
                            {data.evaluations.scored.map((e: any) => (
                                <div key={e.id} className="text-xs text-silver/80 py-1 border-b border-silver/10 last:border-0">
                                    {e.period || fmtD(e.created_at)} · <span className="text-gold">{e.overall_score ?? '—'}</span>{e.rating ? ` · ${e.rating}` : ''}
                                </div>
                            ))}
                        </div>
                        <div className={card}>
                            <h3 className="text-gold text-sm font-bold mb-2">{L('تدريبات موصى بها', 'Recommended trainings')}</h3>
                            {data.trainings.length === 0 ? <p className="text-silver/40 text-xs">{L('لا توجد توصيات تدريب.', 'No training recommendations.')}</p> :
                                <ul className="list-disc ps-5 text-xs text-silver/80 space-y-0.5">{data.trainings.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
