'use client';

import { useState, useEffect, use } from 'react';
import DataTable from '@/components/data/DataTable';
import type { Column } from '@/config/tables';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface DeletedServicesPageProps {
    params: Promise<{ locale: string }>;
}

export default function DeletedServicesPage({ params }: DeletedServicesPageProps) {
    const { locale } = use(params);
    const t = useTranslations();
    const router = useRouter();
    const language = locale as 'ar' | 'en';

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [isCEO, setIsCEO] = useState(false);

    // تحديد ما إذا كان المستخدم الحالي هو CEO (صاحب صلاحية الحذف النهائي)
    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('users').select('role_key').eq('email', user.email).single();
            setIsCEO((data?.role_key || '').toLowerCase() === 'ceo');
        })();
    }, []);

    useEffect(() => { setIsClient(true); }, []);
    useEffect(() => { fetchDeletedServices(); }, []);

    const fetchDeletedServices = async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) setError(error.message);
        else setData(data || []);
        setLoading(false);
    };

    const handleRestore = async (id: string) => {
        const { error } = await supabase.from('services').update({ deleted_at: null }).eq('service_id', id);
        if (!error) await fetchDeletedServices();
    };

    // حذف نهائي — متاح للـ CEO فقط (مؤمَّن أيضاً على مستوى قاعدة البيانات بسياسة RLS)
    const handleHardDelete = async (id: string) => {
        const { error } = await supabase.from('services').delete().eq('service_id', id);
        if (error) setError(error.message);
        else await fetchDeletedServices();
    };

    const daysLeft = (deletedAt: string): number => {
        const elapsed = Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000);
        return Math.max(0, 15 - elapsed);
    };

    const columns: Column[] = [
        { key: 'service_id', label: language === 'ar' ? 'الكود' : 'Code', type: 'text', className: 'text-[12px] px-1 py-1' },
        { key: 'name', label: language === 'ar' ? 'الاسم' : 'Name', type: 'text', className: 'text-[12px] px-1 py-1' },
        { key: 'category', label: language === 'ar' ? 'الفئة' : 'Category', type: 'text', className: 'text-[12px] px-1 py-1' },
        { key: 'sell_price', label: language === 'ar' ? 'سعر البيع' : 'Sell Price', type: 'currency', className: 'text-[12px] px-1 py-1' },
        { key: 'cost_price', label: language === 'ar' ? 'التكلفة' : 'Cost', type: 'currency', className: 'text-[12px] px-1 py-1' },
        { key: 'unit', label: language === 'ar' ? 'الوحدة' : 'Unit', type: 'text', className: 'text-[12px] px-1 py-1' },
        {
            key: 'deleted_at',
            label: language === 'ar' ? 'تاريخ الحذف' : 'Deleted Date',
            type: 'date',
            className: 'text-[12px] px-1 py-1'
        },
        {
            key: 'days_left',
            label: language === 'ar' ? 'باقي للحذف النهائي' : 'Days left',
            type: 'text',
            className: 'text-center text-[12px] px-1 py-1',
            render: (_: any, row: any) => {
                const left = daysLeft(row.deleted_at);
                const cls = left <= 3 ? 'text-red-400' : left <= 7 ? 'text-yellow-400' : 'text-green-400';
                return <span className={`${cls} font-medium`}>{left} {language === 'ar' ? 'يوم' : 'd'}</span>;
            }
        }
    ];

    if (!isClient) {
        return (
            <div className="min-h-screen flex items-center justify-center"
                style={{ backgroundImage: "url('/assets/images/BG.png')", backgroundSize: 'cover', backgroundAttachment: 'fixed' }}>
                <div className="bg-darkwhite/70 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-gold/30 flex flex-col items-center gap-4">
                    <div className="w-20 h-20 relative">
                        <Image src="/assets/images/ERP.svg" alt="ERP" fill className="object-contain animate-pulse" priority />
                    </div>
                    <div className="text-gold font-alata text-xl animate-pulse">{t('loading')}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen"
            style={{ backgroundImage: "url('/assets/images/BG.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
            dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="p-4 md:p-6">
                <div className="bg-darkwhite/70 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-white/10">
                    <div className="mb-2 flex justify-between items-center">
                        <h1 className="text-lg font-alata text-gold drop-shadow-lg">
                            {language === 'ar' ? 'الخدمات المحذوفة' : 'Deleted Services'}
                        </h1>
                        <button onClick={() => router.push(`/${locale}/products?tab=services`)} className="px-3 py-1 bg-gold/20 rounded-lg text-gold text-xs hover:bg-gold hover:text-darkwhite transition-colors">
                            {language === 'ar' ? 'العودة للخدمات' : 'Back to services'}
                        </button>
                    </div>
                    <p className="text-silver/70 text-[11px] mb-3">
                        {language === 'ar'
                            ? 'العناصر المحذوفة تبقى هنا 15 يوم ثم تُحذف نهائياً تلقائياً. الحذف النهائي اليدوي متاح للمدير التنفيذي (CEO) فقط.'
                            : 'Deleted items stay here for 15 days then are permanently removed automatically. Manual permanent delete is available to the CEO only.'}
                    </p>
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}
                    <DataTable
                        tableName="services"
                        columns={columns}
                        data={data}
                        language={language}
                        loading={loading}
                        onRestore={handleRestore}
                        onDelete={isCEO ? handleHardDelete : undefined}
                        showDeleted={true}
                        idColumn="service_id"
                        maxHeight="calc(100dvh - 220px)"
                        minWidth="860px"
                    />
                </div>
            </div>
        </div>
    );
}
