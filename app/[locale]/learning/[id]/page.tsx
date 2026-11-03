'use client';

// Course page — lessons (video / reading / quiz), progress tracking, and a final assessment
// that gates completion. Managers can add, edit, reorder and delete lessons and publish the
// course. External provider courses link out; we never record a provider completion we can't verify.
import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';

// translation UI languages (client-side list; the server validates against its own set)
const TX_LANGS: [string, string][] = [['ar', 'العربية'], ['en', 'English'], ['fr', 'Français'], ['es', 'Español'], ['de', 'Deutsch'], ['tr', 'Türkçe'], ['ur', 'اردو']];
const detectLang = (s: string) => /[؀-ۿ]/.test(s || '') ? 'ar' : 'en';
// minimal client VTT parser (for showing the original captions without a round-trip)
function clientCues(raw: string): { start: string; end: string; text: string }[] {
    const t = (raw || '').replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^WEBVTT[^\n]*\n/, '').trim();
    if (!t) return [];
    return t.split(/\n\s*\n/).map(b => {
        const lines = b.split('\n').filter(l => l.trim());
        const i = lines.findIndex(l => l.includes('-->')); if (i === -1) return null;
        const m = lines[i].match(/([\d:.,]+)\s*-->\s*([\d:.,]+)/); if (!m) return null;
        const txt = lines.slice(i + 1).join('\n').trim(); if (!txt) return null;
        return { start: m[1].replace(',', '.'), end: m[2].replace(',', '.'), text: txt };
    }).filter(Boolean) as any;
}

function embed(url: string): string {
    if (!url) return '';
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vm = url.match(/vimeo\.com\/(\d+)/); if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
    return url;
}

export default function CoursePage() {
    const locale = useLocale(); const isAr = locale === 'ar'; const L = (a: string, e: string) => (isAr ? a : e);
    const { id } = useParams<{ id: string }>(); const router = useRouter();
    const [data, setData] = useState<any | null>(null);
    const [err, setErr] = useState('');
    const [active, setActive] = useState<string | null>(null);
    const [lessonEdit, setLessonEdit] = useState<any | null>(null);
    const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
    const [quizResult, setQuizResult] = useState<any | null>(null);
    const [assessMode, setAssessMode] = useState(false);
    const [assessAns, setAssessAns] = useState<Record<string, number>>({});
    const [assessResult, setAssessResult] = useState<any | null>(null);
    const [showExt, setShowExt] = useState(false);                      // in-app provider reader
    const [mirror, setMirror] = useState<any | null>(null);            // mirrored provider content
    const [mirrorBusy, setMirrorBusy] = useState(false);
    const [mirrorErr, setMirrorErr] = useState('');
    const [contentTx, setContentTx] = useState<string | null>(null);   // translated reading text
    const [capLang, setCapLang] = useState('');                          // '' = original
    const [caps, setCaps] = useState<any[] | null>(null);
    const [txBusy, setTxBusy] = useState(false);

    const field = 'w-full bg-black/30 border border-[#DBA935]/20 rounded-lg px-3 py-2 text-sm text-white focus:border-[#DBA935]/60 outline-none';
    const lbl = 'block text-xs text-[#C0C0C0] mb-1';

    const load = useCallback(async () => {
        const res = await fetch(`/api/lms/courses/${id}`); const j = await res.json();
        if (!res.ok) { setErr(j.message || j.error || 'Error'); return; }
        setData(j); if (!active && j.lessons?.length) setActive(j.lessons[0].id);
    }, [id, active]);
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

    if (err) return <div className="min-h-screen flex items-center justify-center text-red-400" dir={isAr ? 'rtl' : 'ltr'}>{err}</div>;
    if (!data) return <div className="min-h-screen flex items-center justify-center text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</div>;

    const { course: c, lessons, enrollment: e, canManage, me } = data;
    const done: string[] = e?.completed_lessons || [];
    const lesson = lessons.find((l: any) => l.id === active);
    const allQuiz = lessons.flatMap((l: any, li: number) => (Array.isArray(l.quiz) ? l.quiz : []).map((q: any, qi: number) => ({ ...q, _k: `${li}_${qi}` })));

    const enroll = async (action: string) => {
        const res = await fetch('/api/lms/enroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ course_id: id, action }) });
        const j = await res.json(); if (!res.ok) { setErr(j.message || j.error); return; } load();
    };
    const completeLesson = async (lid: string) => {
        if (!e) { setErr(L('سجّل في الكورس أولاً.', 'Enrol first.')); return; }
        await fetch('/api/lms/enroll', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ course_id: id, action: 'complete_lesson', lesson_id: lid }) });
        load();
    };
    const submitLessonQuiz = () => {
        const qs = lesson.quiz || []; let correct = 0;
        qs.forEach((q: any, i: number) => { if (quizAnswers[i] === q.answer_index) correct++; });
        const pct = qs.length ? Math.round(correct / qs.length * 100) : 100;
        setQuizResult({ correct, total: qs.length, pct });
        if (pct >= 60) completeLesson(lesson.id);
    };
    const submitAssessment = async () => {
        let correct = 0;
        allQuiz.forEach((q: any) => { if (assessAns[q._k] === q.answer_index) correct++; });
        const score = allQuiz.length ? Math.round(correct / allQuiz.length * 100) : 0;
        const res = await fetch('/api/lms/enroll', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ course_id: id, action: 'submit_assessment', score }) });
        const j = await res.json(); if (!res.ok) { setErr(j.message || j.error); return; }
        setAssessResult({ score, passed: j.passed, pass_mark: j.pass_mark, completed: j.completed }); load();
    };

    const saveLesson = async () => {
        const action = lessonEdit.id ? 'update_lesson' : 'add_lesson';
        await fetch(`/api/lms/courses/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, lesson: lessonEdit }) });
        setLessonEdit(null); load();
    };
    const delLesson = async (lid: string) => { if (!confirm(L('حذف الدرس؟', 'Delete lesson?'))) return; await fetch(`/api/lms/courses/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_lesson', lesson_id: lid }) }); load(); };
    const publish = async () => { await fetch(`/api/lms/courses/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: c.status === 'published' ? 'draft' : 'published' }) }); load(); };

    const resetLessonView = () => { setQuizAnswers({}); setQuizResult(null); setAssessMode(false); setContentTx(null); setCapLang(''); setCaps(null); };
    const translateContent = async (lang: string) => {
        if (!lang || !lesson?.content) { setContentTx(null); return; }
        setTxBusy(true);
        const res = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'text', text: lesson.content, target: lang, source: detectLang(lesson.content) }) });
        const j = await res.json(); setTxBusy(false);
        if (!res.ok) { setErr(j.message || j.error); return; }
        setContentTx(j.translated);
    };
    const loadCaps = async (lang: string) => {
        setCapLang(lang);
        if (!lang) { setCaps(clientCues(lesson.subtitles)); return; }
        setTxBusy(true);
        const res = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'subtitles', vtt: lesson.subtitles, target: lang, source: detectLang(lesson.subtitles) }) });
        const j = await res.json(); setTxBusy(false);
        if (!res.ok) { setErr(j.message || j.error); return; }
        setCaps(j.cueList || []);
    };

    // Mirror: fetch the provider's public page server-side and read it inside the ERP.
    const openMirror = async () => {
        if (showExt) { setShowExt(false); return; }
        setShowExt(true); setMirrorErr('');
        if (mirror) return;
        setMirrorBusy(true);
        const res = await fetch('/api/lms/mirror', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: c.external_url }) });
        const j = await res.json(); setMirrorBusy(false);
        if (!res.ok) { setMirrorErr((isAr ? j.message?.[0] : j.message?.[1]) || j.error || L('تعذّر العرض.', 'Could not load.')); setMirror(j.result || null); return; }
        setMirror(j);
    };

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="max-w-6xl mx-auto">
                <button onClick={() => router.push(`/${locale}/learning`)} className="text-[#DBA935] text-sm mb-2">← {L('الكتالوج', 'Catalog')}</button>

                {/* header */}
                <div className="bg-black/40 rounded-2xl border border-[#DBA935]/20 p-5 mb-4">
                    <div className="flex items-start gap-3">
                        <span className="text-4xl">{c.cover_emoji || '📘'}</span>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-white">{isAr ? c.title_ar : (c.title_en || c.title_ar)}</h1>
                            <p className="text-[#C0C0C0] text-sm mt-1">{c.description}</p>
                            <div className="flex flex-wrap gap-2 mt-2 text-xs text-[#C0C0C0]">
                                <span className="px-2 py-0.5 rounded-full bg-white/10">{c.provider === 'internal' ? L('داخلي', 'Internal') : c.provider}</span>
                                {c.skill && <span className="px-2 py-0.5 rounded-full bg-white/10">{c.skill}</span>}
                                {c.difficulty && <span className="px-2 py-0.5 rounded-full bg-white/10">{c.difficulty}</span>}
                                {c.duration_minutes ? <span className="px-2 py-0.5 rounded-full bg-white/10">⏱ {c.duration_minutes}{L('د', 'm')}</span> : null}
                                {c.certificate && <span className="px-2 py-0.5 rounded-full bg-[#DBA935]/15 text-[#DBA935]">🎓 {L('شهادة', 'Certificate')}</span>}
                            </div>
                        </div>
                    </div>
                    {(c.prerequisites || c.objectives || c.outcomes) && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
                            {c.prerequisites && <div><div className="text-[#DBA935] mb-1">{L('المتطلبات', 'Prerequisites')}</div><p className="text-[#C0C0C0]">{c.prerequisites}</p></div>}
                            {c.objectives && <div><div className="text-[#DBA935] mb-1">{L('الأهداف', 'Objectives')}</div><p className="text-[#C0C0C0]">{c.objectives}</p></div>}
                            {c.outcomes && <div><div className="text-[#DBA935] mb-1">{L('المخرجات', 'Outcomes')}</div><p className="text-[#C0C0C0]">{c.outcomes}</p></div>}
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-4 items-center">
                        {!e ? <button onClick={() => enroll('enroll')} className="px-4 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold text-sm hover:bg-[#DBA935]/90">{L('سجّل في الكورس', 'Enrol')}</button>
                            : <>
                                <div className="flex-1 min-w-[160px]"><div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-[#DBA935]" style={{ width: `${e.progress_pct || 0}%` }} /></div></div>
                                <span className="text-xs text-[#C0C0C0]">{e.status === 'completed' ? `✓ ${L('مكتمل', 'Completed')}${e.final_score != null ? ` · ${e.final_score}%` : ''}` : `${e.progress_pct || 0}%`}</span>
                                <button onClick={() => enroll('unenroll')} className="text-xs text-red-300 px-2 py-1">{L('إلغاء التسجيل', 'Unenrol')}</button>
                            </>}
                        {c.external_url && <button onClick={openMirror} className="px-4 py-2 rounded-xl bg-green-600/80 text-white text-sm font-bold hover:bg-green-600">{showExt ? L('إخفاء المحتوى', 'Hide content') : L('اعرض محتوى الكورس داخل النظام', 'Show course content in-app')}</button>}
                        {canManage && <>
                            <button onClick={publish} className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20">{c.status === 'published' ? L('إلغاء النشر', 'Unpublish') : L('نشر', 'Publish')}</button>
                            <button onClick={() => setLessonEdit({ title_ar: '', kind: 'text', sort_order: lessons.length, quiz: [] })} className="px-3 py-1.5 rounded-lg bg-[#DBA935]/20 text-[#DBA935] border border-[#DBA935]/40 text-xs">+ {L('درس', 'Lesson')}</button>
                        </>}
                    </div>
                    {/* Provider content is MIRRORED (fetched server-side, re-rendered here) so it
                        reads inside the ERP even when the provider blocks iframes — never a new tab. */}
                    {c.external_url && showExt && (
                        <div className="mt-3 bg-black/30 rounded-xl border border-white/10 p-4">
                            {mirrorBusy && <p className="text-[#C0C0C0] text-sm">{L('جارٍ جلب المحتوى من المزوّد...', 'Fetching content from the provider...')}</p>}
                            {!mirrorBusy && mirrorErr && <p className="text-orange-300 text-sm">{mirrorErr}</p>}
                            {!mirrorBusy && mirror && (
                                <article className="max-h-[640px] overflow-y-auto pe-2">
                                    {mirror.site && <div className="text-[11px] text-silver/50 mb-2">{L('مصدر المحتوى', 'Content source')}: {mirror.site}</div>}
                                    {mirror.title && <h2 className="text-xl font-bold text-white mb-2">{mirror.title}</h2>}
                                    {mirror.description && <p className="text-[#C0C0C0] text-sm mb-3">{mirror.description}</p>}
                                    <div className="space-y-2">
                                        {(mirror.blocks || []).map((b: any, i: number) => (
                                            b.t === 'h' ? <h3 key={i} className="text-[#DBA935] font-bold text-sm mt-3">{b.text}</h3>
                                                : b.t === 'li' ? <div key={i} className="text-[#C0C0C0] text-sm ps-4 relative before:content-['•'] before:absolute before:start-0 before:text-[#DBA935]">{b.text}</div>
                                                    : <p key={i} className="text-[#C0C0C0] text-sm">{b.text}</p>
                                        ))}
                                    </div>
                                    {(mirror.blocks || []).length === 0 && !mirror.description && <p className="text-silver/50 text-sm">{L('لا محتوى نصي متاح من هذه الصفحة.', 'No readable content available from this page.')}</p>}
                                </article>
                            )}
                            <p className="text-silver/40 text-[11px] mt-3 pt-3 border-t border-white/10">{L('يُعرض محتوى المزوّد العام داخل النظام (قراءة فقط، مع نسب المصدر). الفيديوهات والمعامل المحمية تبقى عند المزوّد؛ اعتمد على الدروس والتقييم الداخلي أدناه لإثبات الإنجاز.', 'The provider’s public content is shown inside the ERP (read-only, with source attribution). Protected videos and labs stay with the provider; rely on the in-app lessons and assessment below to record completion.')}</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* lessons list */}
                    <div className="bg-black/40 rounded-2xl border border-[#DBA935]/20 p-3">
                        <h3 className="text-[#DBA935] font-bold text-sm mb-2 px-1">{L('الدروس', 'Lessons')} ({lessons.length})</h3>
                        {lessons.length === 0 && <p className="text-silver/50 text-xs px-1">{L('لا دروس بعد.', 'No lessons yet.')}</p>}
                        <div className="space-y-1">
                            {lessons.map((l: any) => (
                                <div key={l.id} className={`rounded-lg px-2 py-2 cursor-pointer flex items-center justify-between gap-1 ${active === l.id ? 'bg-[#DBA935]/20' : 'hover:bg-white/5'}`} onClick={() => { setActive(l.id); resetLessonView(); }}>
                                    <span className="text-xs text-white flex items-center gap-2">
                                        <span>{done.includes(l.id) ? '✅' : l.kind === 'video' ? '🎬' : l.kind === 'quiz' ? '📝' : '📄'}</span>
                                        {isAr ? l.title_ar : (l.title_en || l.title_ar)}
                                    </span>
                                    {canManage && <span className="flex gap-1"><button onClick={ev => { ev.stopPropagation(); setLessonEdit(l); }} className="text-[#DBA935] text-[11px]">✎</button><button onClick={ev => { ev.stopPropagation(); delLesson(l.id); }} className="text-red-300 text-[11px]">✕</button></span>}
                                </div>
                            ))}
                        </div>
                        {allQuiz.length > 0 && e && (
                            <button onClick={() => { setAssessMode(true); setActive(null); setAssessResult(null); setAssessAns({}); }} className="w-full mt-3 px-3 py-2 rounded-lg bg-[#DBA935] text-[#3E3B3F] font-bold text-xs">🎓 {L('التقييم النهائي', 'Final assessment')} ({allQuiz.length})</button>
                        )}
                    </div>

                    {/* viewer */}
                    <div className="md:col-span-2 bg-black/40 rounded-2xl border border-[#DBA935]/20 p-4 min-h-[300px]">
                        {assessMode ? (
                            <div>
                                <h3 className="text-[#DBA935] font-bold mb-3">{L('التقييم النهائي', 'Final assessment')}</h3>
                                {assessResult ? (
                                    <div className={`p-4 rounded-xl ${assessResult.passed ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>
                                        <div className="text-2xl font-bold">{assessResult.score}%</div>
                                        <p className="text-sm mt-1">{assessResult.passed ? L('مبروك — اجتزت التقييم.', 'Passed — well done.') : L('لم تجتز هذه المرة — راجع الدروس وأعد المحاولة.', 'Not passed this time — review the lessons and retry.')} ({L('حد النجاح', 'Pass mark')} {assessResult.pass_mark}%)</p>
                                        {assessResult.completed && <p className="text-xs mt-2 text-[#C0C0C0]">{L('اكتمل الكورس. تحديث سجل الكفاءة يتطلب اعتماد المدير (في وحدة الكفاءات).', 'Course completed. A competency update requires manager validation (in the competency module).')}</p>}
                                        <button onClick={() => { setAssessResult(null); setAssessAns({}); }} className="mt-3 text-xs underline">{L('إعادة', 'Retry')}</button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {allQuiz.map((q: any, i: number) => (
                                            <div key={q._k} className="bg-black/30 rounded-lg p-3">
                                                <p className="text-white text-sm mb-2">{i + 1}. {q.q}</p>
                                                <div className="space-y-1">{(q.options || []).map((o: string, oi: number) => (
                                                    <label key={oi} className="flex items-center gap-2 text-xs text-[#C0C0C0] cursor-pointer"><input type="radio" name={`a_${q._k}`} checked={assessAns[q._k] === oi} onChange={() => setAssessAns({ ...assessAns, [q._k]: oi })} className="accent-[#DBA935]" />{o}</label>
                                                ))}</div>
                                            </div>
                                        ))}
                                        <button onClick={submitAssessment} className="px-4 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold text-sm">{L('تسليم', 'Submit')}</button>
                                    </div>
                                )}
                            </div>
                        ) : !lesson ? <p className="text-silver/50 text-sm">{L('اختر درساً.', 'Select a lesson.')}</p>
                            : (
                                <div>
                                    <h3 className="text-white font-bold mb-3">{isAr ? lesson.title_ar : (lesson.title_en || lesson.title_ar)}</h3>
                                    {lesson.kind === 'video' && lesson.video_url && <iframe src={embed(lesson.video_url)} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full aspect-video rounded-xl border border-white/10 mb-3" title="lesson" />}

                                    {/* captions with on-demand translation (timestamps preserved) */}
                                    {lesson.kind === 'video' && lesson.subtitles && (
                                        <div className="bg-black/30 rounded-xl border border-white/10 p-3 mb-3">
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <span className="text-[#DBA935] text-xs font-bold">🗩 {L('الترجمة النصية', 'Captions')}</span>
                                                <select value={capLang} onChange={e => loadCaps(e.target.value)} className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
                                                    <option value="">{L('الأصلية', 'Original')}</option>
                                                    {TX_LANGS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                                                </select>
                                            </div>
                                            {txBusy && <div className="text-silver/50 text-xs">{L('جارٍ الترجمة...', 'Translating...')}</div>}
                                            <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                                                {(caps ?? clientCues(lesson.subtitles)).map((cue: any, i: number) => (
                                                    <div key={i} className="flex gap-2"><span className="text-silver/40 font-mono shrink-0">{String(cue.start).split('.')[0]}</span><span className="text-[#C0C0C0]">{cue.text}</span></div>
                                                ))}
                                            </div>
                                            {capLang && <p className="text-silver/40 text-[10px] mt-1">{L('ترجمة آلية (غير رسمية).', 'Machine translation (unofficial).')}</p>}
                                        </div>
                                    )}

                                    {lesson.content && (
                                        <div className="mb-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-silver/50 text-[11px]">{L('ترجمة:', 'Translate:')}</span>
                                                <select onChange={e => translateContent(e.target.value)} className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
                                                    <option value="">{L('بدون', 'Off')}</option>
                                                    {TX_LANGS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                                                </select>
                                                {txBusy && <span className="text-silver/50 text-[11px]">{L('جارٍ...', '...')}</span>}
                                            </div>
                                            <div className="text-[#C0C0C0] text-sm whitespace-pre-wrap">{contentTx || lesson.content}</div>
                                            {contentTx && <p className="text-silver/40 text-[10px] mt-1">{L('ترجمة آلية (غير رسمية).', 'Machine translation (unofficial).')}</p>}
                                        </div>
                                    )}
                                    {lesson.kind === 'quiz' && (lesson.quiz || []).length > 0 && (
                                        <div className="space-y-3">
                                            {quizResult ? (
                                                <div className={`p-3 rounded-xl ${quizResult.pct >= 60 ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>{quizResult.correct}/{quizResult.total} · {quizResult.pct}% {quizResult.pct >= 60 ? `— ✓ ${L('تم', 'done')}` : `— ${L('أعد', 'retry')}`}<button onClick={() => { setQuizResult(null); setQuizAnswers({}); }} className="ms-3 text-xs underline">{L('إعادة', 'Retry')}</button></div>
                                            ) : (<>
                                                {lesson.quiz.map((q: any, i: number) => (
                                                    <div key={i} className="bg-black/30 rounded-lg p-3">
                                                        <p className="text-white text-sm mb-2">{i + 1}. {q.q}</p>
                                                        <div className="space-y-1">{(q.options || []).map((o: string, oi: number) => (
                                                            <label key={oi} className="flex items-center gap-2 text-xs text-[#C0C0C0] cursor-pointer"><input type="radio" name={`q_${i}`} checked={quizAnswers[i] === oi} onChange={() => setQuizAnswers({ ...quizAnswers, [i]: oi })} className="accent-[#DBA935]" />{o}</label>
                                                        ))}</div>
                                                    </div>
                                                ))}
                                                <button onClick={submitLessonQuiz} className="px-4 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold text-sm">{L('تسليم', 'Submit')}</button>
                                            </>)}
                                        </div>
                                    )}
                                    {lesson.kind !== 'quiz' && e && !done.includes(lesson.id) && <button onClick={() => completeLesson(lesson.id)} className="px-4 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold text-sm">{L('إنهاء الدرس', 'Mark as done')}</button>}
                                    {lesson.kind !== 'quiz' && done.includes(lesson.id) && <span className="text-green-300 text-sm">✓ {L('أنهيت هذا الدرس', 'Completed')}</span>}
                                </div>
                            )}
                    </div>
                </div>
            </div>

            {/* lesson editor (managers) */}
            {lessonEdit && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={() => setLessonEdit(null)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 rounded-2xl shadow-2xl border border-[#DBA935]/30 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={ev => ev.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]"><h2 className="text-lg text-[#DBA935]">{lessonEdit.id ? L('تعديل درس', 'Edit lesson') : L('درس جديد', 'New lesson')}</h2><button onClick={() => setLessonEdit(null)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button></div>
                        <div className="p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div><label className={lbl}>{L('العنوان (عربي)', 'Title (AR)')}</label><input value={lessonEdit.title_ar || ''} onChange={e => setLessonEdit({ ...lessonEdit, title_ar: e.target.value })} className={field} /></div>
                                <div><label className={lbl}>{L('العنوان (إنجليزي)', 'Title (EN)')}</label><input value={lessonEdit.title_en || ''} onChange={e => setLessonEdit({ ...lessonEdit, title_en: e.target.value })} className={field} /></div>
                                <div><label className={lbl}>{L('النوع', 'Kind')}</label><select value={lessonEdit.kind} onChange={e => setLessonEdit({ ...lessonEdit, kind: e.target.value })} className={field}><option value="text">{L('قراءة', 'Reading')}</option><option value="video">{L('فيديو', 'Video')}</option><option value="quiz">{L('اختبار', 'Quiz')}</option></select></div>
                                <div><label className={lbl}>{L('الترتيب', 'Order')}</label><input type="number" value={lessonEdit.sort_order ?? 0} onChange={e => setLessonEdit({ ...lessonEdit, sort_order: e.target.value })} className={field} /></div>
                            </div>
                            {lessonEdit.kind === 'video' && <div><label className={lbl}>{L('رابط الفيديو (YouTube/Vimeo/مباشر)', 'Video URL (YouTube/Vimeo/direct)')}</label><input dir="ltr" value={lessonEdit.video_url || ''} onChange={e => setLessonEdit({ ...lessonEdit, video_url: e.target.value })} className={field} /></div>}
                            {lessonEdit.kind === 'video' && <div><label className={lbl}>{L('الترجمة النصية (VTT/SRT — تُترجَم آلياً عند الطلب)', 'Captions (VTT/SRT — auto-translated on demand)')}</label><textarea dir="ltr" rows={4} value={lessonEdit.subtitles || ''} onChange={e => setLessonEdit({ ...lessonEdit, subtitles: e.target.value })} placeholder={'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n...'} className={field} /></div>}
                            <div><label className={lbl}>{L('المحتوى / الشرح', 'Content / notes')}</label><textarea rows={4} value={lessonEdit.content || ''} onChange={e => setLessonEdit({ ...lessonEdit, content: e.target.value })} className={field} /></div>
                            {lessonEdit.kind === 'quiz' && (
                                <div>
                                    <label className={lbl}>{L('أسئلة الاختبار', 'Quiz questions')}</label>
                                    {(lessonEdit.quiz || []).map((q: any, i: number) => (
                                        <div key={i} className="bg-black/20 rounded-lg p-2 mb-2">
                                            <input value={q.q || ''} onChange={e => setLessonEdit({ ...lessonEdit, quiz: lessonEdit.quiz.map((x: any, j: number) => j === i ? { ...x, q: e.target.value } : x) })} placeholder={L('السؤال', 'Question')} className={`${field} mb-1`} />
                                            {(q.options || ['', '', '', '']).map((o: string, oi: number) => (
                                                <div key={oi} className="flex items-center gap-2 mb-1">
                                                    <input type="radio" name={`ans_${i}`} checked={q.answer_index === oi} onChange={() => setLessonEdit({ ...lessonEdit, quiz: lessonEdit.quiz.map((x: any, j: number) => j === i ? { ...x, answer_index: oi } : x) })} className="accent-[#DBA935]" title={L('الإجابة الصحيحة', 'Correct')} />
                                                    <input value={o} onChange={e => setLessonEdit({ ...lessonEdit, quiz: lessonEdit.quiz.map((x: any, j: number) => j === i ? { ...x, options: (x.options || ['', '', '', '']).map((oo: string, k: number) => k === oi ? e.target.value : oo) } : x) })} placeholder={`${L('خيار', 'Option')} ${oi + 1}`} className={`${field} flex-1`} />
                                                </div>
                                            ))}
                                            <button onClick={() => setLessonEdit({ ...lessonEdit, quiz: lessonEdit.quiz.filter((_: any, j: number) => j !== i) })} className="text-red-300 text-xs">{L('حذف السؤال', 'Delete question')}</button>
                                        </div>
                                    ))}
                                    <button onClick={() => setLessonEdit({ ...lessonEdit, quiz: [...(lessonEdit.quiz || []), { q: '', options: ['', '', '', ''], answer_index: 0 }] })} className="text-[#DBA935] text-xs">+ {L('سؤال', 'Question')}</button>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-silver/20 sticky bottom-0 bg-[#1a1a1e]"><button onClick={() => setLessonEdit(null)} className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm">{L('إلغاء', 'Cancel')}</button><button onClick={saveLesson} className="px-4 py-2 rounded-lg bg-[#DBA935] text-[#3E3B3F] font-bold text-sm">{L('حفظ', 'Save')}</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}
