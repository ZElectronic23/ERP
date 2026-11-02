'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import AIChatModal from './AIChatModal';
import { pageHelpFor } from '@/lib/pageInfo';

export default function FloatingActions() {
    const t = useTranslations();
    const pathname = usePathname();
    const locale = useLocale();
    const [isAIOpen, setIsAIOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);

    // اللغة من next-intl (المسار قد لا يحمل بادئة اللغة)
    const isRTL = locale === 'ar';
    const help = pageHelpFor(pathname);
    const HL = (o: { ar: string; en: string }) => (isRTL ? o.ar : o.en);

    const handleWhatsApp = () => {
        const message = encodeURIComponent(t('whatsappHelpMessage') || 'أحتاج مساعدة في ERP');
        window.open(`https://wa.me/201004496397?text=${message}`, '_blank');
    };

    const handleAIOpen = () => setIsAIOpen(true);
    const handleAIClose = () => setIsAIOpen(false);

    return (
        <>
            <div
                className="fixed bottom-6 z-50 flex flex-col gap-3"
                style={{ right: '24px' }}
            >
                {/* زر المعلومات (شرح الصفحة الحالية) - ثابت فوق زر الواتساب */}
                <button
                    onClick={() => setIsInfoOpen(true)}
                    className="w-8 h-8 rounded-full bg-gold/90 hover:bg-gold transition-colors shadow-lg flex items-center justify-center text-darkwhite font-bold"
                    title={isRTL ? 'ما هذه الصفحة؟' : 'What is this page?'}
                    aria-label={isRTL ? 'شرح الصفحة' : 'Page info'}
                >
                    <span className="text-sm leading-none">ℹ</span>
                </button>

                {/* زر الواتساب - يتحول للأبيض عند hover */}
                <button
                    onClick={handleWhatsApp}
                    className="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 transition-colors shadow-lg flex items-center justify-center group"
                    title={t('whatsappSupport')}
                >
                    <Image
                        src="/assets/images/Whatsapp.svg"
                        alt="WhatsApp"
                        width={16}
                        height={16}
                        className="w-4 h-4 transition-all duration-300 group-hover:brightness-0 group-hover:invert"
                    />
                </button>

                {/* زر الروبوت (دائري بدون خلفية) - يفتح شات الدردشة */}
                <button
                    onClick={handleAIOpen}
                    className="w-8 h-8 rounded-full overflow-hidden shadow-lg hover:opacity-90 transition-opacity"
                    title={t('aiAssistant')}
                >
                    <Image
                        src="/assets/images/AI.svg"
                        alt="AI Assistant"
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                    />
                </button>
            </div>

            {/* نافذة شرح الصفحة الحالية */}
            {isInfoOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
                    onClick={() => setIsInfoOpen(false)}
                    dir={isRTL ? 'rtl' : 'ltr'}
                >
                    <div className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl border border-gold/30 p-6 shadow-2xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-alata text-gold flex items-center gap-2"><span>ℹ️</span>{HL(help.title)}</h3>
                            <button onClick={() => setIsInfoOpen(false)} className="p-1 hover:bg-silver/20 rounded-lg transition text-silver">✕</button>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-gold/80 text-xs font-bold mb-0.5">{isRTL ? 'ما هذه الصفحة؟' : 'What is this page?'}</p>
                                <p className="text-silver/90 leading-relaxed">{HL(help.what)}</p>
                            </div>
                            <div>
                                <p className="text-gold/80 text-xs font-bold mb-0.5">{isRTL ? 'كيف تتعامل معها؟' : 'How do you use it?'}</p>
                                <p className="text-silver/90 leading-relaxed">{HL(help.how)}</p>
                            </div>
                        </div>
                        <p className="text-silver/40 text-[11px] mt-4 pt-3 border-t border-silver/15">{isRTL ? 'ما يظهر لك محكوم بصلاحياتك.' : 'What you see is governed by your permissions.'}</p>
                    </div>
                </div>
            )}

            {/* Modal AI */}
            <AIChatModal
                isOpen={isAIOpen}
                onClose={handleAIClose}
                pathname={pathname || ''}
            />
        </>
    );
}