'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import WeatherPopup from './WeatherPopup';
import { fetchWeatherData } from '@/lib/weather';

export default function Header() {
    // جميع الـ Hooks في الأعلى
    const t = useTranslations();
    const pathname = usePathname();
    const locale = pathname?.split('/')[1] || 'ar';
    const language = locale as 'ar' | 'en';

    const [currentTime, setCurrentTime] = useState('');
    const [currentDate, setCurrentDate] = useState('');
    const [isDateExpanded, setIsDateExpanded] = useState(false);
    const [isWeatherOpen, setIsWeatherOpen] = useState(false);
    const [weatherData, setWeatherData] = useState<any>(null);
    const [weatherLoading, setWeatherLoading] = useState(false);

    // useEffect – يجب أن يكون قبل أي return شرطي
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

    // بعد الـ Hooks، يمكن وضع return شرطي
    if (pathname?.includes('login')) return null;

    // بقية الكود...
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

    return (
        <>
            <header className="sticky top-0 z-50 w-full px-1 py-0">
                <div className="grid grid-cols-3 items-center max-w-5xl mx-auto bg-black/10 backdrop-blur-sm rounded-full border border-gold/20 shadow-lg px-0 py-0 min-h-[40px] md:min-h-[44px]">
                    <div className="flex justify-start items-center gap-0">
                        <div className="ms-1 sm:ms-2">
                            <UserMenu />
                        </div>
                        <NotificationBell />
                    </div>
                    <div className="flex justify-center items-center -my-2 sm:-my-3">
                        <Image
                            src="/assets/images/ERP.svg"
                            alt="ERP"
                            width={90}
                            height={90}
                            className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 lg:w-20 lg:h-20 object-contain"
                            priority
                        />
                    </div>
                    <div className="flex justify-end items-center text-silver px-1">
                        <div
                            className="flex items-center gap-1 cursor-pointer hover:border hover:border-gold/50 rounded-full px-1 py-0 transition-all leading-8 sm:leading-9 md:leading-10"
                            onMouseEnter={() => setIsDateExpanded(true)}
                            onMouseLeave={() => setIsDateExpanded(false)}
                        >
                            <span suppressHydrationWarning className="text-[0.7rem] sm:text-xs md:text-sm lg:text-base">
                                {currentTime || '--:--'}
                            </span>
                            {isDateExpanded && (
                                <>
                                    <span className="text-[0.55rem] sm:text-[0.65rem] md:text-xs text-silver/80">
                                        {shortDate}
                                    </span>
                                    <button
                                        onClick={openWeatherPopup}
                                        className="text-gold hover:text-yellow-500 transition-colors"
                                        title={fullDate}
                                    >
                                        <Image
                                            src="/assets/images/cloud.svg"
                                            alt={t('weather')}
                                            width={14}
                                            height={14}
                                            className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4 object-contain"
                                        />
                                    </button>
                                </>
                            )}
                        </div>
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