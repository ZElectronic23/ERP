'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import AIChatModal from './AIChatModal';

export default function FloatingActions() {
    const t = useTranslations();
    const pathname = usePathname();
    const [isAIOpen, setIsAIOpen] = useState(false);

    // استخراج اللغة من المسار لتحديد الاتجاه
    const locale = pathname?.split('/')[1] || 'ar';
    const isRTL = locale === 'ar';

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
                style={{ [isRTL ? 'left' : 'right']: '24px' }}
            >
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

            {/* Modal AI */}
            <AIChatModal
                isOpen={isAIOpen}
                onClose={handleAIClose}
                pathname={pathname || ''}
            />
        </>
    );
}