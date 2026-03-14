'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import WeatherPopup from './WeatherPopup';
import { fetchWeatherData } from '@/lib/weather';

export default function Header() {
    const t = useTranslations();
    const pathname = usePathname();
    const router = useRouter();
    const locale = pathname?.split('/')[1] || 'ar';
    const language = locale as 'ar' | 'en';

    // حالة الوقت والتاريخ
    const [currentTime, setCurrentTime] = useState('');
    const [currentDate, setCurrentDate] = useState('');
    const [isDateExpanded, setIsDateExpanded] = useState(false);
    const [isWeatherOpen, setIsWeatherOpen] = useState(false);
    const [weatherData, setWeatherData] = useState<any>(null);
    const [weatherLoading, setWeatherLoading] = useState(false);

    // تحديث الوقت كل دقيقة
    useEffect(() => {
        const updateDateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }));
            setCurrentDate(now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }));
        };
        updateDateTime();
        const timer = setInterval(updateDateTime, 60000);
        return () => clearInterval(timer);
    }, [language]);

    const now = new Date();
    const dayName = now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' }).slice(0, 3);
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString().slice(-2);
    const shortDate = `${dayName} ${day}/${month}/${year}`;
    const fullDate = now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const openWeatherPopup = async () => {
        setIsWeatherOpen(true);
        setWeatherLoading(true);
        try {
            const data = await fetchWeatherData(language);
            setWeatherData(data);
        } catch (error) {
            console.error('Weather error:', error);
        } finally {
            setWeatherLoading(false);
        }
    };

    const toggleLanguage = () => {
        const newLocale = language === 'ar' ? 'en' : 'ar';
        const newPath = pathname.replace(`/${language}`, `/${newLocale}`);
        router.push(newPath);
    };

    return (
        <>
            <header className="sticky top-4 z-50 w-full px-4">
                <div className="max-w-7xl mx-auto bg-[#1a1a1a]/80 backdrop-blur-md rounded-full border border-gold/30 shadow-lg px-6 py-2 flex items-center justify-between">
                    {/* الوقت - يسار */}
                    <div className="relative">
                        <div
                            className="flex items-center gap-1 text-silver cursor-pointer hover:border hover:border-gold/50 rounded-full px-2 py-1 transition-all"
                            onMouseEnter={() => setIsDateExpanded(true)}
                            onMouseLeave={() => setIsDateExpanded(false)}
                        >
                            <span suppressHydrationWarning className="text-sm">{currentTime}</span>
                            {isDateExpanded && (
                                <>
                                    <span className="text-xs text-silver/80">{shortDate}</span>
                                    <button onClick={openWeatherPopup} className="text-gold hover:text-yellow-500 transition-colors" title={fullDate}>
                                        <Image src="/assets/images/cloud.svg" alt={t('weather')} width={20} height={20} className="w-5 h-5 object-contain" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* اللوجو - وسط */}
                    <div className="flex items-center justify-center">
                        <Image src="/assets/images/ERP.svg" alt="ERP" width={120} height={120} className="w-24 h-24 md:w-28 md:h-28 object-contain" priority />
                    </div>

                    {/* أيقونات اليمين: الإشعارات وصورة المستخدم */}
                    <div className="flex items-center gap-3">
                        <NotificationBell />
                        <UserMenu />
                    </div>
                </div>
            </header>

            <WeatherPopup
                isOpen={isWeatherOpen}
                onClose={() => setIsWeatherOpen(false)}
                weatherData={weatherData}
                loading={weatherLoading}
                language={language}
            />
        </>
    );
}