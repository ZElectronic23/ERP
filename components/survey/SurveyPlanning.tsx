'use client';

import { useState, useEffect, useCallback } from 'react';

export default function SurveyPlanning({ surveyId, locale = 'ar', projectCode }: { surveyId: string; locale?: string; projectCode?: string }) {
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);
    const [info, setInfo] = useState<{ project_code: string | null; survey_number: string; generated: number } | null>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [msg, setMsg] = useState('');

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/surveys/${surveyId}/plan`);
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            setInfo(j);
        } catch (e: any) { setErr(e.message); }
    }, [surveyId]);

    useEffect(() => { load(); }, [load, projectCode]);
    const linked = projectCode || info?.project_code || null;

    const generate = async () => {
        setBusy(true); setErr(''); setMsg('');
        try {
            const res = await fetch(`/api/surveys/${surveyId}/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate' }) });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            setMsg(L(`تم إنشاء ${j.created} بند تخطيط في المشروع ${j.project_code}`, `Created ${j.created} plan items in project ${j.project_code}`));
            load();
        } catch (e: any) { setErr(e.message); }
        setBusy(false);
    };

    return (
        <div className="bg-black/40 backdrop-blur-sm p-4 md:p-5 rounded-3xl border border-[#DBA935]/20">
            <h2 className="text-[#DBA935] font-bold">{L('التخطيط والتسعير', 'Planning & pricing')}</h2>
            <p className="text-[#C0C0C0] text-xs mb-3">{L('يُغذّي وحدة التخطيط القائمة ببنود مبدئية من المسح — الأسعار والهوامش تُحدَّد هناك (غير مُقدَّرة تلقائياً)، والتكاليف الداخلية مقيّدة بصلاحيات المشروع.', 'Feeds the existing planning module with draft items from the survey — prices/margins are set there (not auto-estimated); internal costs stay restricted.')}</p>

            {err && <div className="mb-2 text-red-400 text-sm">{err}</div>}
            {msg && <div className="mb-2 text-green-400 text-sm">{msg}</div>}

            {!linked ? (
                <p className="text-yellow-300/80 text-sm">{L('اربط المسح بمشروع قائم من الأعلى (قائمة «المشروع المرتبط») واحفظ، لتوليد بنود التخطيط — بدون إنشاء مشروع مكرر.', 'Link the survey to an existing project above and save to generate plan items — no duplicate project.')}</p>
            ) : (
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-white">{L('المشروع المرتبط:', 'Linked project:')} <span className="font-mono text-[#DBA935]">{linked}</span></span>
                    {(info?.generated ?? 0) > 0 && <span className="text-xs text-[#C0C0C0]">{L(`بنود مُولّدة من هذا المسح: ${info?.generated}`, `Items generated from this survey: ${info?.generated}`)}</span>}
                    <button onClick={generate} disabled={busy} className="px-4 py-2 rounded-lg bg-[#DBA935] text-[#3E3B3F] font-bold text-sm hover:bg-[#DBA935]/90 disabled:opacity-50">
                        {busy ? L('...', '...') : (info?.generated ?? 0) > 0 ? L('↻ إعادة توليد البنود', '↻ Regenerate items') : L('⚙ توليد بنود التخطيط', '⚙ Generate plan items')}
                    </button>
                    <a href={`/${locale}/projects/${linked}`} target="_blank" rel="noopener noreferrer" className="text-[#DBA935] text-sm hover:underline">{L('فتح تخطيط المشروع ←', 'Open project planning ←')}</a>
                </div>
            )}
        </div>
    );
}
