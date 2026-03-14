'use client';

import { useState, useEffect, use } from 'react';
import DataTable from '@/components/data/DataTable';
import { tableConfigs } from '@/config/tables';
import type { Column } from '@/config/tables';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import WeatherPopup from '@/components/WeatherPopup';
import { fetchWeatherData } from '@/lib/weather';
import UserMenu from '@/components/UserMenu';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface DeletedProductsPageProps {
    params: Promise<{ locale: string }>;
}

export default function DeletedProductsPage({ params }: DeletedProductsPageProps) {
    const { locale } = use(params);
    const t = useTranslations();
    const router = useRouter();
    const pathname = usePathname();
    const language = locale as 'ar' | 'en';

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [imagesLoaded, setImagesLoaded] = useState(false);
    const [isWeatherOpen, setIsWeatherOpen] = useState(false);
    const [weatherData, setWeatherData] = useState<any>(null);
    const [weatherLoading, setWeatherLoading] = useState(false);
    const [isDateExpanded, setIsDateExpanded] = useState(false);

    const config = tableConfigs.products;

    useEffect(() => {
        setIsClient(true);
        const urls = [
            '/assets/images/cloud.svg', '/assets/images/ERP.svg',
            '/assets/images/BG.png', '/assets/images/product.svg'
        ];
        let n = 0;
        urls.forEach(url => {
            const img = new window.Image(); img.src = url;
            img.onload = img.onerror = () => { if (++n === urls.length) setImagesLoaded(true); };
        });
    }, []);

    useEffect(() => {
        fetchDeletedProducts();
    }, []);

    const fetchDeletedProducts = async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) {
            setError(error.message);
        } else {
            setData(data || []);
        }
        setLoading(false);
    };

    const handleRestore = async (id: string) => {
        const { error } = await supabase
            .from('products')
            .update({ deleted_at: null })
            .eq('product_id', id);
        if (!error) {
            await fetchDeletedProducts();
        }
    };

    const openWeatherPopup = async () => {
        setIsWeatherOpen(true); setWeatherLoading(true);
        try { setWeatherData(await fetchWeatherData(language)); }
        catch (e) { console.error(e); }
        finally { setWeatherLoading(false); }
    };

    const toggleLanguage = () => {
        const newLocale = language === 'ar' ? 'en' : 'ar';
        const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
        router.push(newPath);
    };

    const now = new Date();
    const timeString = now.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    const dayName = now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' }).slice(0, 3);
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString().slice(-2);
    const shortDate = `${dayName} ${day}/${month}/${year}`;
    const fullDate = now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const imageColumn: Column = {
        key: 'image',
        label: language === 'ar' ? 'صورة' : 'Image',
        type: 'image',
        render: (_: any, row: any) => (
            <div className="flex justify-center">
                {row.image
                    ? <Image src={row.image} alt={row.name} width={30} height={30} className="rounded object-cover opacity-60" />
                    : <Image src="/assets/images/product.svg" alt="product" width={30} height={30} className="rounded object-cover opacity-40" />
                }
            </div>
        ),
        className: 'text-center'
    };

    const baseColumns = config.columns.filter(col => col.key !== 'image');
    const columns: Column[] = [
        imageColumn,
        ...baseColumns.map((col: any) => ({ ...col, type: col.type || 'text', className: 'text-[12px] px-1 py-1' })),
        {
            key: 'deleted_at',
            label: language === 'ar' ? 'تاريخ الحذف' : 'Deleted Date',
            type: 'date',
            className: 'text-[12px] px-1 py-1'
        }
    ];

    if (!isClient || !imagesLoaded) {
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
        <div
            className="min-h-screen p-4 md:p-6"
            style={{ backgroundImage: "url('/assets/images/BG.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
            <div className="min-h-screen bg-darkwhite/70 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-white/10">
                <div className="relative w-full mb-2" style={{ minHeight: '70px' }}>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2">
                        <div
                            onMouseEnter={() => setIsDateExpanded(true)}
                            onMouseLeave={() => setIsDateExpanded(false)}
                            className="flex items-center gap-1 text-silver cursor-pointer hover:border hover:border-gold/50 rounded-full px-2 py-1 transition-all"
                        >
                            <span suppressHydrationWarning className="text-sm">{timeString}</span>
                            {isDateExpanded && (
                                <>
                                    <span className="text-xs text-silver/80">{shortDate}</span>
                                    <button onClick={openWeatherPopup} className="text-gold hover:text-yellow-500 transition-colors" title={fullDate}>
                                        <Image src="/assets/images/cloud.svg" alt={t('weather')} width={20} height={20} className="w-5 h-5 object-contain" priority />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <Image src="/assets/images/ERP.svg" alt="ERP" width={140} height={140} className="w-28 h-28 md:w-32 md:h-32 object-contain" priority />
                    </div>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2" style={{ zIndex: 99999 }}>
                        <UserMenu />
                    </div>
                </div>
                <div className="mb-3 flex justify-between items-center">
                    <h1 className="text-lg font-alata text-gold drop-shadow-lg">{t('deletedProducts')}</h1>
                    <button onClick={() => router.push(`/${locale}/products`)} className="px-3 py-1 bg-gold/20 rounded-lg text-gold text-xs hover:bg-gold hover:text-darkwhite transition-colors">
                        {t('backToProducts')}
                    </button>
                </div>
                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}
                <div className="relative w-full">
                    <div className="overflow-auto max-h-[70vh] scrollbar-thin scrollbar-thumb-gold/50 scrollbar-track-transparent">
                        <DataTable
                            tableName="products"
                            columns={columns}
                            data={data}
                            language={language}
                            loading={loading}
                            onRestore={handleRestore}
                            showDeleted={true}
                        />
                    </div>
                </div>
            </div>
            <WeatherPopup isOpen={isWeatherOpen} onClose={() => setIsWeatherOpen(false)} weatherData={weatherData} loading={weatherLoading} language={language} />
        </div>
    );
}