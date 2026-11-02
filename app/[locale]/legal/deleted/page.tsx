'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';

interface Contract {
    id: string;
    contract_number: string | null;
    title: string;
    party_name: string | null;
    status: string;
    deleted_at: string;
}

export default function DeletedContractsPage() {
    const router = useRouter();
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [rows, setRows] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCEO, setIsCEO] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase.from('contracts').select('*')
            .not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        if (error) setError(error.message); else setRows((data as Contract[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('users').select('role_key').eq('email', user.email).single();
            setIsCEO((data?.role_key || '').toLowerCase() === 'ceo');
        })();
    }, []);

    const restore = async (id: string) => {
        const { error } = await supabase.from('contracts').update({ deleted_at: null }).eq('id', id);
        if (!error) load();
    };

    const hardDelete = async (id: string) => {
        if (!confirm(L('حذف نهائي لا يمكن التراجع عنه. متأكد؟', 'Permanent delete cannot be undone. Sure?'))) return;
        const { error } = await supabase.from('contracts').delete().eq('id', id);
        if (error) setError(error.message); else load();
    };

    const daysLeft = (d: string) => Math.max(0, 15 - Math.floor((Date.now() - new Date(d).getTime()) / 86400000));

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-3">
                    <h1 className="text-xl font-bold text-[#DBA935]">{L('العقود المحذوفة', 'Deleted Contracts')}</h1>
                    <button onClick={() => router.push(`/${locale}/legal`)} className="px-3 py-1 bg-gold/20 rounded-lg text-gold text-xs hover:bg-gold hover:text-darkwhite transition">
                        {L('رجوع للعقود', 'Back to contracts')}
                    </button>
                </div>
                <p className="text-silver/70 text-[11px] mb-3">
                    {L('العناصر المحذوفة تبقى هنا 15 يوم ثم تُحذف نهائياً تلقائياً. الحذف النهائي اليدوي متاح للمدير التنفيذي (CEO) فقط.',
                        'Deleted items stay 15 days then are permanently removed. Manual permanent delete is CEO only.')}
                </p>
                {error && <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}

                <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                    <table className="w-full text-sm" style={{ minWidth: '680px' }}>
                        <thead>
                            <tr className="bg-[#242428] text-[#DBA935]/90">
                                {[L('الرقم', 'No.'), L('العنوان', 'Title'), L('الطرف', 'Party'), L('تاريخ الحذف', 'Deleted'), L('باقٍ', 'Left'), L('الإجراءات', 'Actions')].map((h, i) => (
                                    <th key={i} className="py-2.5 px-3 text-start font-semibold whitespace-nowrap border-b border-[#DBA935]/20">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="text-center py-10 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-10 text-[#C0C0C0]">{L('لا توجد عقود محذوفة', 'No deleted contracts')}</td></tr>
                            ) : rows.map(c => {
                                const left = daysLeft(c.deleted_at);
                                const cls = left <= 3 ? 'text-red-400' : left <= 7 ? 'text-yellow-400' : 'text-green-400';
                                return (
                                    <tr key={c.id} className="odd:bg-white/[0.02] border-b border-[#3E3B3F]/60 text-white">
                                        <td className="py-2.5 px-3 whitespace-nowrap text-[#DBA935]">{c.contract_number || '—'}</td>
                                        <td className="py-2.5 px-3">{c.title}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">{c.party_name || '—'}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">{new Date(c.deleted_at).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</td>
                                        <td className={`py-2.5 px-3 whitespace-nowrap font-medium ${cls}`}>{left} {L('يوم', 'd')}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-3">
                                                <button onClick={() => restore(c.id)} className="text-green-400 hover:underline">{L('استعادة', 'Restore')}</button>
                                                {isCEO && <button onClick={() => hardDelete(c.id)} className="text-red-700 hover:text-red-500 font-semibold">{L('حذف نهائي', 'Delete forever')}</button>}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
