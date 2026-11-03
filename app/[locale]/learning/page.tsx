'use client';

// LMS catalog. Employees browse courses relevant to them (department / all-staff), filter by
// skill / level / provider / price, enrol, and track progress. HR / managers / owners can create
// and publish courses. Free/open-source courses are listed first; external courses link out.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';

const DIFF: Record<string, { ar: string; en: string; cls: string }> = {
    beginner: { ar: 'مبتدئ', en: 'Beginner', cls: 'bg-green-500/15 text-green-300 border-green-500/30' },
    intermediate: { ar: 'متوسط', en: 'Intermediate', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
    advanced: { ar: 'متقدّم', en: 'Advanced', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
    expert: { ar: 'خبير', en: 'Expert', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
};
const PRICE: Record<string, { ar: string; en: string; cls: string }> = {
    free: { ar: 'مجاني', en: 'FREE', cls: 'bg-green-500/20 text-green-300 border-green-500/40' },
    freemium: { ar: 'مجاني جزئياً', en: 'FREEMIUM', cls: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
    paid: { ar: 'مدفوع', en: 'PAID', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
};
const PROVIDERS = ['internal', 'IBM', 'HP', 'Cisco', 'Microsoft', 'Google', 'Udemy', 'other'];

export default function LearningPage() {
    const locale = useLocale(); const isAr = locale === 'ar'; const L = (a: string, e: string) => (isAr ? a : e);
    const router = useRouter();
    const [courses, setCourses] = useState<any[]>([]);
    const [canManage, setCanManage] = useState(false);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [q, setQ] = useState('');
    const [fDiff, setFDiff] = useState('');
    const [fProv, setFProv] = useState('');
    const [fPrice, setFPrice] = useState('');
    const [tab, setTab] = useState<'all' | 'mine'>('all');
    const [form, setForm] = useState<any | null>(null);

    const field = 'w-full bg-black/30 border border-[#DBA935]/20 rounded-lg px-3 py-2 text-sm text-white focus:border-[#DBA935]/60 outline-none';
    const lbl = 'block text-xs text-[#C0C0C0] mb-1';

    const load = useCallback(async () => {
        setLoading(true); setErr('');
        try {
            const p = new URLSearchParams();
            if (q) p.set('q', q); if (fDiff) p.set('difficulty', fDiff); if (fProv) p.set('provider', fProv); if (fPrice) p.set('pricing', fPrice);
            if (tab === 'mine') p.set('mine', '1');
            const res = await fetch(`/api/lms/courses?${p}`); const j = await res.json();
            if (!res.ok) throw new Error(j.message || j.error || 'Error');
            setCourses(j.courses || []); setCanManage(!!j.canManage);
        } catch (e: any) { setErr(e.message); }
        setLoading(false);
    }, [q, fDiff, fProv, fPrice, tab]);
    useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

    const stats = useMemo(() => ({
        total: courses.length,
        enrolled: courses.filter(c => c.enrollment).length,
        completed: courses.filter(c => c.enrollment?.status === 'completed').length,
    }), [courses]);

    const saveCourse = async () => {
        if (!form.title_ar?.trim()) { setErr(L('العنوان مطلوب.', 'Title required.')); return; }
        const res = await fetch('/api/lms/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        const j = await res.json(); if (!res.ok) { setErr(j.message || j.error); return; }
        setForm(null); if (j.course?.id) router.push(`/${locale}/learning/${j.course.id}`); else load();
    };

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#DBA935]">{L('التعلّم والتدريب', 'Learning & Training')}</h1>
                        <p className="text-[#C0C0C0] text-sm mt-1">{L('كورسات مرتبطة بعملك ومهاراتك — سجّل، تعلّم، واجتز التقييم.', 'Courses matched to your role and skills — enrol, learn, and pass the assessment.')}</p>
                    </div>
                    {canManage && <button onClick={() => setForm({ title_ar: '', provider: 'internal', difficulty: 'beginner', pricing: 'free', status: 'draft', cover_emoji: '📘', has_subtitles: false, certificate: false })} className="px-4 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm">+ {L('كورس جديد', 'New course')}</button>}
                </div>

                <div className="flex flex-wrap gap-3 mb-4 text-xs">
                    <span className="px-3 py-1.5 rounded-lg bg-white/5 text-[#C0C0C0]">{L('المتاح', 'Available')}: <b className="text-white">{stats.total}</b></span>
                    <span className="px-3 py-1.5 rounded-lg bg-white/5 text-[#C0C0C0]">{L('مسجّل فيها', 'Enrolled')}: <b className="text-sky-300">{stats.enrolled}</b></span>
                    <span className="px-3 py-1.5 rounded-lg bg-white/5 text-[#C0C0C0]">{L('مكتملة', 'Completed')}: <b className="text-green-300">{stats.completed}</b></span>
                </div>

                <div className="flex gap-2 mb-3">
                    {(['all', 'mine'] as const).map(k => <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-xl text-sm transition ${tab === k ? 'bg-[#DBA935] text-[#3E3B3F] font-bold' : 'bg-white/5 text-[#C0C0C0] hover:bg-white/10'}`}>{k === 'all' ? L('كل الكورسات', 'All courses') : L('كورساتي', 'My courses')}</button>)}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder={L('ابحث بعنوان/مهارة/مزوّد...', 'Search title/skill/provider...')} className={`${field} flex-1 min-w-[200px]`} />
                    <select value={fDiff} onChange={e => setFDiff(e.target.value)} className={`${field} w-auto`}><option value="">{L('كل المستويات', 'All levels')}</option>{Object.keys(DIFF).map(d => <option key={d} value={d}>{isAr ? DIFF[d].ar : DIFF[d].en}</option>)}</select>
                    <select value={fProv} onChange={e => setFProv(e.target.value)} className={`${field} w-auto`}><option value="">{L('كل المزوّدين', 'All providers')}</option>{PROVIDERS.map(p => <option key={p} value={p}>{p === 'internal' ? L('داخلي', 'Internal') : p}</option>)}</select>
                    <select value={fPrice} onChange={e => setFPrice(e.target.value)} className={`${field} w-auto`}><option value="">{L('مجاني ومدفوع', 'Free & paid')}</option>{Object.keys(PRICE).map(p => <option key={p} value={p}>{isAr ? PRICE[p].ar : PRICE[p].en}</option>)}</select>
                </div>

                {err && <div className="mb-3 text-red-400 text-sm">{err}</div>}

                {loading ? <div className="text-center py-16 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</div>
                    : courses.length === 0 ? <div className="text-center py-16 text-[#C0C0C0] text-sm">{L('لا كورسات مطابقة.', 'No matching courses.')}</div>
                        : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {courses.map(c => {
                                    const e = c.enrollment;
                                    return (
                                        <div key={c.id} onClick={() => router.push(`/${locale}/learning/${c.id}`)} className="bg-black/30 rounded-xl border border-white/10 p-4 cursor-pointer hover:border-[#DBA935]/40 transition flex flex-col">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <span className="text-3xl">{c.cover_emoji || '📘'}</span>
                                                <div className="flex flex-wrap gap-1 justify-end">
                                                    {c.pricing && <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${PRICE[c.pricing]?.cls}`}>{isAr ? PRICE[c.pricing]?.ar : PRICE[c.pricing]?.en}</span>}
                                                    {c.status !== 'published' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-silver">{c.status}</span>}
                                                </div>
                                            </div>
                                            <h3 className="text-white font-bold text-sm">{isAr ? c.title_ar : (c.title_en || c.title_ar)}</h3>
                                            <p className="text-[#C0C0C0] text-xs line-clamp-2 mt-1 flex-1">{c.description || c.skill || '—'}</p>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {c.difficulty && <span className={`text-[10px] px-2 py-0.5 rounded-full border ${DIFF[c.difficulty]?.cls}`}>{isAr ? DIFF[c.difficulty]?.ar : DIFF[c.difficulty]?.en}</span>}
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#C0C0C0]">{c.provider === 'internal' ? L('داخلي', 'Internal') : c.provider}</span>
                                                {c.duration_minutes ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#C0C0C0]">⏱ {c.duration_minutes}{L('د', 'm')}</span> : null}
                                                {c.certificate && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#DBA935]/15 text-[#DBA935] border border-[#DBA935]/30">🎓 {L('شهادة', 'Cert')}</span>}
                                            </div>
                                            {e && (
                                                <div className="mt-3">
                                                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-[#DBA935]" style={{ width: `${e.progress_pct || 0}%` }} /></div>
                                                    <div className="text-[10px] text-[#C0C0C0] mt-1">{e.status === 'completed' ? `✓ ${L('مكتمل', 'Completed')}` : `${e.progress_pct || 0}% · ${L('مسجّل', 'Enrolled')}`}</div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
            </div>

            {form && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={() => setForm(null)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 rounded-2xl shadow-2xl border border-[#DBA935]/30 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]"><h2 className="text-lg text-[#DBA935]">{L('كورس جديد', 'New course')}</h2><button onClick={() => setForm(null)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button></div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div><label className={lbl}>{L('العنوان (عربي) *', 'Title (AR) *')}</label><input value={form.title_ar} onChange={e => setForm({ ...form, title_ar: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('العنوان (إنجليزي)', 'Title (EN)')}</label><input value={form.title_en || ''} onChange={e => setForm({ ...form, title_en: e.target.value })} className={field} /></div>
                            <div className="md:col-span-2"><label className={lbl}>{L('الوصف', 'Description')}</label><textarea rows={2} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('المزوّد', 'Provider')}</label><select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} className={field}>{PROVIDERS.map(p => <option key={p} value={p}>{p === 'internal' ? L('داخلي', 'Internal') : p}</option>)}</select></div>
                            <div><label className={lbl}>{L('المهارة الأساسية', 'Primary skill')}</label><input value={form.skill || ''} onChange={e => setForm({ ...form, skill: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('المستوى', 'Difficulty')}</label><select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })} className={field}>{Object.keys(DIFF).map(d => <option key={d} value={d}>{isAr ? DIFF[d].ar : DIFF[d].en}</option>)}</select></div>
                            <div><label className={lbl}>{L('التسعير', 'Pricing')}</label><select value={form.pricing} onChange={e => setForm({ ...form, pricing: e.target.value })} className={field}>{Object.keys(PRICE).map(p => <option key={p} value={p}>{isAr ? PRICE[p].ar : PRICE[p].en}</option>)}</select></div>
                            <div><label className={lbl}>{L('القسم المستهدف (فارغ = الكل)', 'Target department (blank = all)')}</label><input value={form.department || ''} onChange={e => setForm({ ...form, department: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('المدة (دقيقة)', 'Duration (min)')}</label><input type="number" value={form.duration_minutes || ''} onChange={e => setForm({ ...form, duration_minutes: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('رابط خارجي (لكورسات المزوّدين)', 'External URL (for provider courses)')}</label><input dir="ltr" value={form.external_url || ''} onChange={e => setForm({ ...form, external_url: e.target.value })} placeholder="https://..." className={field} /></div>
                            <div><label className={lbl}>{L('المتطلبات المسبقة', 'Prerequisites')}</label><input value={form.prerequisites || ''} onChange={e => setForm({ ...form, prerequisites: e.target.value })} className={field} /></div>
                            <div className="md:col-span-2"><label className={lbl}>{L('أهداف التعلّم', 'Objectives')}</label><textarea rows={2} value={form.objectives || ''} onChange={e => setForm({ ...form, objectives: e.target.value })} className={field} /></div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={!!form.has_subtitles} onChange={e => setForm({ ...form, has_subtitles: e.target.checked })} className="accent-[#DBA935] w-4 h-4" />{L('ترجمة/ذاتية', 'Subtitles')}</label>
                                <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={!!form.certificate} onChange={e => setForm({ ...form, certificate: e.target.checked })} className="accent-[#DBA935] w-4 h-4" />{L('شهادة', 'Certificate')}</label>
                            </div>
                            <div><label className={lbl}>{L('الحالة', 'Status')}</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={field}><option value="draft">{L('مسودة', 'Draft')}</option><option value="published">{L('منشور', 'Published')}</option></select></div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-silver/20 sticky bottom-0 bg-[#1a1a1e]">
                            <button onClick={() => setForm(null)} className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20">{L('إلغاء', 'Cancel')}</button>
                            <button onClick={saveCourse} className="px-4 py-2 rounded-lg bg-[#DBA935] text-[#3E3B3F] font-bold text-sm hover:bg-[#DBA935]/90">{L('حفظ وإضافة الدروس', 'Save & add lessons')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
