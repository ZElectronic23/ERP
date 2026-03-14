'use client';

import { useRef, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

interface NotificationModalProps {
    notification: {
        id: string;
        title: string;
        message: string;
        type: 'info' | 'success' | 'warning' | 'error';
        link?: string;
        created_at: string;
    };
    onClose: () => void;
}

export default function NotificationModal({ notification, onClose }: NotificationModalProps) {
    const t = useTranslations();
    const router = useRouter();
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleLinkClick = () => {
        if (notification.link) {
            router.push(notification.link);
        }
        onClose();
    };

    const typeColors = {
        success: 'bg-green-500/20 text-green-400 border-green-500/30',
        error: 'bg-red-500/20 text-red-400 border-red-500/30',
        warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };

    const typeIcons = {
        success: '/assets/images/success.svg',
        error: '/assets/images/error.svg',
        warning: '/assets/images/warning.svg',
        info: '/assets/images/info.svg',
    };

    return (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div
                ref={modalRef}
                className="bg-[#1a1a1e] rounded-2xl border border-gold/30 w-full max-w-md"
            >
                {/* رأس المودال */}
                <div className="flex justify-between items-center p-4 border-b border-silver/20">
                    <h2 className="text-gold font-alata text-lg">{t('notificationDetails')}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-silver/20 rounded-lg transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-silver">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* محتوى المودال */}
                <div className="p-6">
                    <div className={`flex items-center gap-3 p-4 rounded-xl border ${typeColors[notification.type]}`}>
                        <div className="w-8 h-8">
                            <Image
                                src={typeIcons[notification.type]}
                                alt={notification.type}
                                width={32}
                                height={32}
                                className="w-8 h-8"
                            />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold">{notification.title}</h3>
                            <p className="text-sm text-silver/80">{notification.message}</p>
                        </div>
                    </div>

                    <div className="mt-4 text-silver/60 text-xs flex justify-between">
                        <span>{new Date(notification.created_at).toLocaleString()}</span>
                        {notification.link && (
                            <button
                                onClick={handleLinkClick}
                                className="text-gold hover:underline"
                            >
                                {t('viewDetails')}
                            </button>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold text-sm hover:bg-yellow-600 transition-colors"
                        >
                            {t('close')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}