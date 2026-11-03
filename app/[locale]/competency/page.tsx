'use client';

// Competency & skills — each employee's skill profile (levels, validation, certifications) and,
// for managers, a validation queue plus a staffing finder. A course completion yields a PENDING
// skill that a manager must validate (completion != expert). Staffing suggestions are advisory.
import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';

const LEVELS: Record<number, { ar: string; en: string }> = {
    1: { ar: 'مبتدئ', en: 'Beginner' }, 2: { ar: 'أساسي', en: 'Basic' }, 3: { ar: 'متوسط', en: 'Intermediate' }, 4: { ar: 'متقدّم', en: 'Advanced' }, 5: { ar: 'خبير', en: 'Expert' },
};
const SOURCE: Record<string, { ar: string; en: string }> = {
    self: { ar: 'ذاتي', en: 'Self' }, course: { ar: 'كورس', en: 'Course' }, assessment: { ar: 'تقييم', en: 'Assessment' }, manager: { ar: 'المدير', en: 'Manager' },
};

export default function CompetencyPage() {
    const locale = useLocale(); const isAr = locale === 'ar'; const L = (a: string, e: string) => (isAr ? a : e);
    const [tab, setTab] = useState<'me' | 'team' | 'staffing'>('me');
    const [data, setData] = useState<any | null>(null);
    const [team, setTeam] = useState<any[]>([]);
    const [canValidate, setCanValidate] = useState(false);
    const [viewId, setViewId] = useState<string | null>(null);  // manager viewing an employee
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);
    // staffing
    const [needSkills, setNeedSkills] = useState('');
    const [minLevel, setMinLevel] = useState(1);
    const [candidates, setCandidates] = useState<any[] | null>(null);
    // add forms
    const [newSkill, setNewSkill] = useState({ skill: '', level: 1 });
    const [newCert, setNewCert] = useState<any>({ name: '', issuer: '', issued_on: '', credential_url: '' });

    const field = 'bg-black/30 border border-[#DBA935]/20 rounded-lg px-3 py-2 text-sm text-white focus:border-[#DBA935]/60 outline-none';

    const loadProfile = useCallback(async (empId?: string | null) => {
        setLoading(true); setErr('');
        try {
            const res = await fetch(`/api/competency${empId ? `?employee_id=${empId}` : ''}`);
            const j = await res.json(); if (!res.ok) throw new Error(j.message || j.error);
            setData(j); setCanValidate(!!j.canValidate);
        } catch (e: any) { setErr(e.message); }
        setLoading(false);
    }, []);
    const loadTeam = useCallback(async () => {
        const res = await fetch('/api/competency?team=1'); const j = await res.json();
        if (res.ok) setTeam(j.team || []); else setErr(j.message || j.error);
    }, []);

    useEffect(() => { loadProfile(null); }, [loadProfile]);
    useEffect(() => { if (tab === 'team' && canValidate) loadTeam(); }, [tab, canValidate, loadTeam]);

    const post = async (body: any) => { const r = await fetch('/api/competency', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) { setErr(j.message || j.error); return null; } return j; };
    const patch = async (body: any) => { const r = await fetch('/api/competency', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) { setErr(j.message || j.error); return null; } return j; };
    const del = async (kind: string, id: string) => { await fetch(`/api/competency?kind=${kind}&id=${id}`, { method: 'DELETE' }); refresh(); };
    const refresh = () => loadProfile(viewId);

    const addSkill = async () => { if (!newSkill.skill.trim()) return; await post({ action: 'add_skill', skill: newSkill.skill.trim(), level: newSkill.level, employee_id: viewId || undefined }); setNewSkill({ skill: '', level: 1 }); refresh(); };
    const addCert = async () => { if (!newCert.name.trim()) return; await post({ action: 'add_cert', ...newCert, employee_id: viewId || undefined }); setNewCert({ name: '', issuer: '', issued_on: '', credential_url: '' }); refresh(); };
    const fromCourses = async () => { const j = await post({ action: 'from_courses', employee_id: viewId || undefined }); if (j) { setErr(''); alert(L(`تمت إضافة ${j.added} مهارة من الكورسات (بانتظار الاعتماد).`, `${j.added} skill(s) added from courses (pending validation).`)); refresh(); } };
    const validateSkill = async (id: string, level: number) => { await patch({ action: 'validate_skill', id, level }); refresh(); };
    const setLevel = async (id: string, level: number) => { await patch({ action: 'set_level', id, level }); refresh(); };
    const verifyCert = async (id: string) => { await patch({ action: 'verify_cert', id }); refresh(); };

    const runStaffing = async () => {
        const skills = needSkills.split(',').map(s => s.trim()).filter(Boolean);
        const j = await post({ action: 'staffing', skills, min_level: minLevel });
        if (j) setCandidates(j.candidates || []);
    };

    const openEmployee = (empId: string) => { setViewId(empId); setTab('me'); loadProfile(empId); };
    const backToMe = () => { setViewId(null); loadProfile(null); };

    const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-5xl mx-auto">
                <h1 className="text-2xl font-bold text-[#DBA935]">{L('الكفاءات والمهارات', 'Competency & Skills')}</h1>
                <p className="text-[#C0C0C0] text-sm mt-1 mb-4">{L('ملف مهاراتك وشهاداتك — يُحدَّث بعد الكورسات باعتماد المدير. إكمال الكورس لا يعني الخبرة تلقائياً.', 'Your skills & certifications — updated after courses with manager validation. Completing a course does not auto-grant expertise.')}</p>

                <div className="flex gap-2 mb-4 flex-wrap">
                    <button onClick={() => { backToMe(); setTab('me'); }} className={`px-4 py-2 rounded-xl text-sm transition ${tab === 'me' ? 'bg-[#DBA935] text-[#3E3B3F] font-bold' : 'bg-white/5 text-[#C0C0C0] hover:bg-white/10'}`}>{viewId ? L('ملف الموظف', 'Employee profile') : L('ملفي', 'My profile')}</button>
                    {canValidate && <button onClick={() => setTab('team')} className={`px-4 py-2 rounded-xl text-sm transition ${tab === 'team' ? 'bg-[#DBA935] text-[#3E3B3F] font-bold' : 'bg-white/5 text-[#C0C0C0] hover:bg-white/10'}`}>{L('الفريق', 'Team')}</button>}
                    {canValidate && <button onClick={() => setTab('staffing')} className={`px-4 py-2 rounded-xl text-sm transition ${tab === 'staffing' ? 'bg-[#DBA935] text-[#3E3B3F] font-bold' : 'bg-white/5 text-[#C0C0C0] hover:bg-white/10'}`}>{L('باحث التوظيف', 'Staffing finder')}</button>}
                </div>

                {err && <div className="mb-3 text-red-400 text-sm">{err}</div>}

                {/* PROFILE */}
                {tab === 'me' && (loading ? <div className="text-center py-16 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</div>
                    : !data?.employee ? <div className="text-center py-16 text-[#C0C0C0] text-sm">{L('لا يوجد ملف موظف مرتبط بحسابك.', 'No employee linked to your account.')}</div>
                        : (<div className="space-y-5">
                            {viewId && <button onClick={backToMe} className="text-[#DBA935] text-sm">← {L('رجوع لملفي', 'Back to my profile')}</button>}
                            <div className="bg-black/30 rounded-xl border border-white/10 p-4">
                                <div className="flex flex-wrap justify-between gap-2">
                                    <div><h2 className="text-white font-bold">{data.employee.Name}</h2><p className="text-[#C0C0C0] text-xs">{data.employee.Position || '—'} · {data.employee.Department || '—'}</p></div>
                                    <div className="text-xs text-[#C0C0C0] text-end">
                                        <div>{L('المهام المفتوحة', 'Open tasks')}: <b className="text-white">{data.openTasks}</b></div>
                                        <div>{L('كورسات مكتملة', 'Completed courses')}: <b className="text-green-300">{data.completedCourses.length}</b></div>
                                    </div>
                                </div>
                            </div>

                            {/* skills */}
                            <div>
                                <div className="flex items-center justify-between mb-2"><h3 className="text-[#DBA935] font-bold">{L('المهارات', 'Skills')}</h3>
                                    <button onClick={fromCourses} className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20">↻ {L('توليد من الكورسات', 'Generate from courses')}</button>
                                </div>
                                {data.skills.length === 0 ? <p className="text-silver/50 text-sm">{L('لا مهارات بعد.', 'No skills yet.')}</p>
                                    : <div className="space-y-2">{data.skills.map((s: any) => (
                                        <div key={s.id} className="bg-black/30 rounded-xl border border-white/10 p-3 flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <span className="text-white text-sm font-bold">{s.skill}</span>
                                                <span className="text-[#DBA935] text-sm ms-2" title={isAr ? LEVELS[s.level]?.ar : LEVELS[s.level]?.en}>{stars(s.level)}</span>
                                                <span className="text-[11px] text-[#C0C0C0] ms-2">{isAr ? LEVELS[s.level]?.ar : LEVELS[s.level]?.en} · {isAr ? SOURCE[s.source]?.ar : SOURCE[s.source]?.en}</span>
                                                {s.validated ? <span className="text-[11px] text-green-300 ms-2">✓ {L('معتمد', 'Validated')}</span> : <span className="text-[11px] text-yellow-300 ms-2">⏳ {L('بانتظار الاعتماد', 'Pending')}</span>}
                                                {s.evidence && <div className="text-silver/50 text-[11px] mt-0.5">{s.evidence}</div>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {canValidate && (
                                                    <>
                                                        <select value={s.level} onChange={e => setLevel(s.id, Number(e.target.value))} className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{isAr ? LEVELS[n].ar : LEVELS[n].en}</option>)}</select>
                                                        {!s.validated && <button onClick={() => validateSkill(s.id, s.level)} className="text-[11px] px-2 py-1 rounded-lg bg-green-600/80 text-white">{L('اعتماد', 'Validate')}</button>}
                                                    </>
                                                )}
                                                {(canValidate || (!s.validated && !viewId)) && <button onClick={() => del('skill', s.id)} className="text-red-300 text-[11px]">✕</button>}
                                            </div>
                                        </div>
                                    ))}</div>}
                                {/* add skill */}
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <input value={newSkill.skill} onChange={e => setNewSkill({ ...newSkill, skill: e.target.value })} placeholder={L('مهارة جديدة', 'New skill')} className={`${field} flex-1 min-w-[160px]`} />
                                    <select value={newSkill.level} onChange={e => setNewSkill({ ...newSkill, level: Number(e.target.value) })} className={field}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{isAr ? LEVELS[n].ar : LEVELS[n].en}</option>)}</select>
                                    <button onClick={addSkill} className="px-4 py-2 rounded-lg bg-[#DBA935] text-[#3E3B3F] font-bold text-sm">{L('إضافة', 'Add')}</button>
                                </div>
                                {!canValidate && !viewId && <p className="text-silver/50 text-[11px] mt-1">{L('المهارات التي تضيفها بنفسك تظل «بانتظار الاعتماد» حتى يعتمدها مديرك.', 'Skills you add yourself stay "pending" until your manager validates them.')}</p>}
                            </div>

                            {/* certifications */}
                            <div>
                                <h3 className="text-[#DBA935] font-bold mb-2">{L('الشهادات', 'Certifications')}</h3>
                                {data.certifications.length === 0 ? <p className="text-silver/50 text-sm">{L('لا شهادات.', 'No certifications.')}</p>
                                    : <div className="space-y-2">{data.certifications.map((c: any) => (
                                        <div key={c.id} className="bg-black/30 rounded-xl border border-white/10 p-3 flex flex-wrap items-center justify-between gap-2">
                                            <div><span className="text-white text-sm font-bold">{c.name}</span>{c.issuer && <span className="text-[#C0C0C0] text-xs ms-2">— {c.issuer}</span>}{c.issued_on && <span className="text-silver/50 text-[11px] ms-2">{c.issued_on}</span>}
                                                {c.verified ? <span className="text-green-300 text-[11px] ms-2">✓ {L('موثّقة', 'Verified')}</span> : <span className="text-yellow-300 text-[11px] ms-2">⏳</span>}
                                                {c.credential_url && <a href={c.credential_url} target="_blank" rel="noopener noreferrer" className="text-[#DBA935] text-[11px] ms-2 underline">{L('الرابط', 'Link')}</a>}
                                            </div>
                                            <div className="flex gap-2">{canValidate && !c.verified && <button onClick={() => verifyCert(c.id)} className="text-[11px] px-2 py-1 rounded-lg bg-green-600/80 text-white">{L('توثيق', 'Verify')}</button>}{(canValidate || !viewId) && <button onClick={() => del('cert', c.id)} className="text-red-300 text-[11px]">✕</button>}</div>
                                        </div>
                                    ))}</div>}
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <input value={newCert.name} onChange={e => setNewCert({ ...newCert, name: e.target.value })} placeholder={L('اسم الشهادة', 'Certification name')} className={`${field} flex-1 min-w-[140px]`} />
                                    <input value={newCert.issuer} onChange={e => setNewCert({ ...newCert, issuer: e.target.value })} placeholder={L('الجهة', 'Issuer')} className={field} />
                                    <input type="date" value={newCert.issued_on} onChange={e => setNewCert({ ...newCert, issued_on: e.target.value })} className={field} />
                                    <button onClick={addCert} className="px-4 py-2 rounded-lg bg-[#DBA935] text-[#3E3B3F] font-bold text-sm">{L('إضافة', 'Add')}</button>
                                </div>
                            </div>

                            {/* completed courses as evidence */}
                            {data.completedCourses.length > 0 && (
                                <div>
                                    <h3 className="text-[#DBA935] font-bold mb-2">{L('كورسات مكتملة (دليل)', 'Completed courses (evidence)')}</h3>
                                    <div className="flex flex-wrap gap-2">{data.completedCourses.map((e: any, i: number) => (
                                        <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-[#C0C0C0]">🎓 {e.course ? (isAr ? e.course.title_ar : (e.course.title_en || e.course.title_ar)) : e.course_id}{e.final_score != null ? ` · ${e.final_score}%` : ''}</span>
                                    ))}</div>
                                </div>
                            )}
                        </div>))}

                {/* TEAM */}
                {tab === 'team' && canValidate && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {team.map((e: any) => (
                            <div key={e.EmployeeID} onClick={() => openEmployee(e.EmployeeID)} className="bg-black/30 rounded-xl border border-white/10 p-3 cursor-pointer hover:border-[#DBA935]/40">
                                <div className="flex justify-between items-start"><span className="text-white font-bold text-sm">{e.Name}</span>
                                    {e.skills.pending > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">{e.skills.pending} {L('بانتظار', 'pending')}</span>}</div>
                                <p className="text-[#C0C0C0] text-xs">{e.Position || '—'} · {e.Department || '—'}</p>
                                <p className="text-silver/60 text-[11px] mt-1">{e.skills.validated} {L('معتمدة', 'validated')} / {e.skills.total} {L('إجمالي', 'total')}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* STAFFING */}
                {tab === 'staffing' && canValidate && (
                    <div>
                        <div className="bg-black/30 rounded-xl border border-white/10 p-4 mb-4">
                            <p className="text-[#C0C0C0] text-sm mb-2">{L('أدخل المهارات المطلوبة (مفصولة بفاصلة) للعثور على أنسب الموظفين — ترشيح استشاري فقط، الإسناد بموافقة بشرية.', 'Enter the required skills (comma-separated) to find the best-matched employees — advisory only; assignment needs human approval.')}</p>
                            <div className="flex flex-wrap gap-2">
                                <input value={needSkills} onChange={e => setNeedSkills(e.target.value)} placeholder={L('مثال: شبكات، أمن سيبراني', 'e.g. Networking, Cybersecurity')} className={`${field} flex-1 min-w-[200px]`} />
                                <select value={minLevel} onChange={e => setMinLevel(Number(e.target.value))} className={field}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{L('حد أدنى', 'min')} {isAr ? LEVELS[n].ar : LEVELS[n].en}</option>)}</select>
                                <button onClick={runStaffing} className="px-4 py-2 rounded-lg bg-[#DBA935] text-[#3E3B3F] font-bold text-sm">{L('ابحث', 'Find')}</button>
                            </div>
                        </div>
                        {candidates && (candidates.length === 0 ? <p className="text-silver/50 text-sm">{L('لا مرشّحين بمهارات معتمدة مطابقة.', 'No candidates with matching validated skills.')}</p>
                            : <div className="space-y-2">{candidates.map((c: any, i: number) => (
                                <div key={i} className="bg-black/30 rounded-xl border border-white/10 p-3">
                                    <div className="flex justify-between items-start"><div><span className="text-white font-bold text-sm">{c.employee.Name}</span><span className="text-[#C0C0C0] text-xs ms-2">{c.employee.Position || '—'}</span></div>
                                        <span className="text-[11px] text-[#C0C0C0]">{L('المهام المفتوحة', 'Open tasks')}: <b className={c.open_tasks > 4 ? 'text-red-300' : 'text-green-300'}>{c.open_tasks}</b></span></div>
                                    <div className="flex flex-wrap gap-1 mt-2">{c.matched.map((m: any, j: number) => <span key={j} className="text-[11px] px-2 py-0.5 rounded-full bg-[#DBA935]/15 text-[#DBA935]">{m.skill} {stars(m.level)}</span>)}</div>
                                </div>
                            ))}</div>)}
                    </div>
                )}
            </div>
        </div>
    );
}
