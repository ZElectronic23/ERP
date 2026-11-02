'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { WORK_TYPES } from '@/lib/survey/catalog';

interface SurveyRow {
    id: string;
    survey_number: string | null;
    title: string | null;
    project_code: string | null;
    client_id: string | null;
    work_types: string[] | null;
    status: string;
    progress: number;
    created_at: string;
}

const STATUS_LABEL: Record<string, { ar: string; en: string; cls: string }> = {
    draft: { ar: 'مسودة', en: 'Draft', cls: 'bg-silver/20 text-silver' },
    in_progress: { ar: 'قيد التنفيذ', en: 'In progress', cls: 'bg-blue-500/20 text-blue-300' },
    submitted: { ar: 'مُرسل', en: 'Submitted', cls: 'bg-yellow-500/20 text-yellow-300' },
    reviewed: { ar: 'تمت المراجعة', en: 'Reviewed', cls: 'bg-purple-500/20 text-purple-300' },
    approved: { ar: 'معتمد', en: 'Approved', cls: 'bg-green-500/20 text-green-300' },
    cancelled: { ar: 'ملغي', en: 'Cancelled', cls: 'bg-red-500/20 text-red-300' },
};

export default function SurveysPage() {
    const router = useRouter();
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [rows, setRows] = useState<SurveyRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [err, setErr] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/surveys');
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            setRows(j.surveys || []);
        } catch (e: any) { setErr(e.message); }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const createSurvey = async () => {
        setCreating(true);
        try {
            const res = await fetch('/api/surveys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ work_types: [] }) });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Error');
            router.push(`/${locale}/surveys/${j.survey.id}`);
        } catch (e: any) { setErr(e.message); setCreating(false); }
    };

    const typeLabels = (keys: string[] | null) => (keys || []).map(k => {
        const w = WORK_TYPES.find(x => x.key === k); return w ? (isAr ? w.ar : w.en) : k;
    });

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#DBA935]">{L('المسح الفني', 'Technical Survey')}</h1>
                        <p className="text-[#C0C0C0] text-sm mt-1">{L('مسح فني موحّد لكل أنواع المشاريع والخدمات — يظهر لك الأسئلة المناسبة فقط.', 'One guided survey for every project type — it shows only the relevant questions.')}</p>
                    </div>
                    <button onClick={createSurvey} disabled={creating} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm disabled:opacity-50">
                        {creating ? L('جارٍ الإنشاء...', 'Creating...') : L('+ مسح جديد', '+ New survey')}
                    </button>
                </div>

                {err && <div className="mb-4 text-red-400 text-sm">{err}</div>}

                {loading ? <div className="text-center py-16 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</div>
                    : rows.length === 0 ? <div className="text-center py-16 text-[#C0C0C0] text-sm">{L('لا توجد عمليات مسح بعد. ابدأ بمسح جديد.', 'No surveys yet. Start a new one.')}</div>
                        : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-[#C0C0C0]">
                                    <thead>
                                        <tr className="text-[#DBA935] text-xs border-b border-[#DBA935]/20">
                                            <th className="py-2 px-3 text-start">{L('الرقم', 'No.')}</th>
                                            <th className="py-2 px-3 text-start">{L('العنوان', 'Title')}</th>
                                            <th className="py-2 px-3 text-start">{L('أنواع العمل', 'Work types')}</th>
                                            <th className="py-2 px-3 text-start">{L('التقدّم', 'Progress')}</th>
                                            <th className="py-2 px-3 text-start">{L('الحالة', 'Status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map(r => {
                                            const st = STATUS_LABEL[r.status] || STATUS_LABEL.draft;
                                            return (
                                                <tr key={r.id} onClick={() => router.push(`/${locale}/surveys/${r.id}`)} className="border-b border-white/5 hover:bg-[#DBA935]/5 cursor-pointer">
                                                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-xs">{r.survey_number || '—'}</td>
                                                    <td className="py-2.5 px-3">{r.title || L('بدون عنوان', 'Untitled')}</td>
                                                    <td className="py-2.5 px-3 text-xs">{typeLabels(r.work_types).join('، ') || '—'}</td>
                                                    <td className="py-2.5 px-3 w-32">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-[#DBA935]" style={{ width: `${r.progress}%` }} /></div>
                                                            <span className="text-xs">{r.progress}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-xs ${st.cls}`}>{isAr ? st.ar : st.en}</span></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
            </div>
        </div>
    );
}
