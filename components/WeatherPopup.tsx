'use client';

import { translations, Language } from '@/lib/translations'

interface WeatherPopupProps {
    isOpen: boolean
    onClose: () => void
    weatherData: any
    loading: boolean
    language: Language
}

export default function WeatherPopup({ isOpen, onClose, weatherData, loading, language }: WeatherPopupProps) {
    const t = translations[language]

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(8px)'
            }}
            onClick={onClose}
        >
            <div
                className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl border border-gold/30 p-6 shadow-2xl max-w-sm w-full"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-alata text-gold">
                        {language === 'ar' ? 'الطقس' : 'Weather'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-silver/20 rounded-lg transition"
                    >
                        <span className="material-icons text-silver">close</span>
                    </button>
                </div>

                {loading ? (
                    <div className="py-8 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
                        <p className="text-silver mt-2">{t.loading}</p>
                    </div>
                ) : weatherData ? (
                    <div className="space-y-4">
                        <div className="text-center">
                            <div className="text-5xl mb-2">🌤️</div>
                            <p className="text-3xl font-bold text-white mt-2">{weatherData.temp}°C</p>
                            <p className="text-silver capitalize">{weatherData.condition}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-silver/20">
                            <div>
                                <p className="text-silver text-sm">
                                    {language === 'ar' ? 'الرياح' : 'Wind'}
                                </p>
                                <p className="text-white font-medium">{weatherData.windSpeed} كم/س</p>
                            </div>
                        </div>

                        <p className="text-center text-sm text-silver/70 mt-2">
                            {weatherData.location}
                        </p>
                    </div>
                ) : (
                    <p className="text-center text-silver py-4">
                        {language === 'ar' ? 'لا توجد بيانات' : 'No data available'}
                    </p>
                )}
            </div>
        </div>
    )
}