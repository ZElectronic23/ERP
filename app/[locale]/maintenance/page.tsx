'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

interface DocRow {
    id: string;
    doc_number: string;
    doc_type: string;
    doc_date: string;
    status: string;
    visit_location?: string | null;
    equipment_status?: string | null;
    total: number;
    clients: { name: string } | null;
    employees: { name: string } | null;
}

const TYPE_LABEL: Record<string, { ar: string; en: string }> = {
    REP: { ar: 'فحص وصيانة', en: 'Maintenance' },
    VR: { ar: 'زيارة فنية', en: 'Visit' },
};

export default function MaintenancePage() {
    const router = useRouter();
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [rows, setRows] = useState<DocRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'REP' | 'VR'>('REP');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/documents?type=${tab}&limit=50`);
            const data = await res.json();
            setRows(data.documents || []);
        } catch { setRows([]); }
        setLoading(false);
    }, [tab]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#DBA935]">{L('الصيانة والخدمة الفنية', 'Maintenance & Technical Service')}</h1>
                        <p className="text-[#C0C0C0] text-sm mt-1">{L('تقارير الفحص والصيانة والزيارات الفنية', 'Maintenance reports and technical visits')}</p>
                    </div>
                    <button onClick={() => router.push(`/${locale}/documents/new`)} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm">
                        {L('+ تقرير جديد', '+ New Report')}
                    </button>
                </div>

                <div className="flex gap-2 mb-4">
                    {(['REP', 'VR'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t ? 'bg-[#DBA935] text-[#3E3B3F]' : 'bg-white/5 text-[#C0C0C0] hover:bg-white/10'}`}>
                            {isAr ? TYPE_LABEL[t].ar : TYPE_LABEL[t].en}
                        </button>
                    ))}
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                    <table className="w-full text-sm" style={{ minWidth: '760px' }}>
                        <thead>
                            <tr className="bg-[#242428] text-[#DBA935]/90">
                                {[L('الرقم', 'No.'), L('التاريخ', 'Date'), L('العميل', 'Client'), L('الفني', 'Technician'), L('الموقع', 'Location'), L('الحالة', 'Status'), L('الإجراءات', 'Actions')].map((h, i) => (
                                    <th key={i} className="py-2.5 px-3 text-start font-semibold whitespace-nowrap border-b border-[#DBA935]/20">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan={7} className="text-center py-10 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</td></tr>
                                : rows.length === 0 ? <tr><td colSpan={7} className="text-center py-10 text-[#C0C0C0]">{L('لا توجد تقارير', 'No reports')}</td></tr>
                                    : rows.map(d => (
                                        <tr key={d.id} className="odd:bg-white/[0.02] hover:bg-[#DBA935]/10 transition border-b border-[#3E3B3F]/60 text-white cursor-pointer" onClick={() => router.push(`/${locale}/documents/${d.id}`)}>
                                            <td className="py-2.5 px-3 whitespace-nowrap text-[#DBA935] font-medium">{d.doc_number}</td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">{d.doc_date}</td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">{d.clients?.name || '—'}</td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">{d.employees?.name || '—'}</td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">{d.visit_location || '—'}</td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">{d.status}</td>
                                            <td className="py-2.5 px-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => router.push(`/${locale}/documents/${d.id}`)} className="text-[#DBA935] hover:underline">{L('فتح', 'Open')}</button>
                                            </td>
                                        </tr>
                                    ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
