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
                {/* زر الواتساب - حجم أصغر */}
                <button
                    onClick={handleWhatsApp}
                    className="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 transition-colors shadow-lg flex items-center justify-center"
                    title={t('whatsappSupport')}
                >
                    <Image
                        src="/assets/images/Whatsapp.svg"
                        alt="WhatsApp"
                        width={16}
                        height={16}
                        className="w-4 h-4"
                    />
                </button>

                {/* زر AI - حجم أصغر */}
                <button
                    onClick={handleAIOpen}
                    className="w-8 h-8 rounded-full bg-gold hover:bg-yellow-600 transition-colors shadow-lg flex items-center justify-center"
                    title={t('aiAssistant')}
                >
                    <Image
                        src="/assets/images/AI.svg"
                        alt="AI Assistant"
                        width={16}
                        height={16}
                        className="w-4 h-4"
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