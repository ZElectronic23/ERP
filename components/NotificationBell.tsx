'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';
import NotificationModal from './NotificationModal';

interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    link?: string;
    is_read: boolean;
    created_at: string;
}

export default function NotificationBell() {
    const t = useTranslations();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const bellRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setCurrentUserId(user.id);
        });
    }, []);

    const fetchNotifications = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (!error && data) {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchNotifications();

        const subscription = supabase
            .channel('notifications')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                (payload) => {
                    const newNotif = payload.new as Notification;
                    if (currentUserId && newNotif.user_id === currentUserId) {
                        setNotifications(prev => [newNotif, ...prev]);
                        setUnreadCount(prev => prev + 1);
                    }
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [currentUserId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAsRead = async (id: string) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (!error) {
            setNotifications(prev =>
                prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    const markAllAsRead = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (!error) {
            setNotifications(prev =>
                prev.map(n => ({ ...n, is_read: true }))
            );
            setUnreadCount(0);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        setIsOpen(false);
        if (!notification.is_read) {
            markAsRead(notification.id);
        }
        setSelectedNotification(notification);
        setShowModal(true);
    };

    const handleModalClose = () => {
        setShowModal(false);
        setSelectedNotification(null);
    };

    return (
        <>
            <div className="relative" ref={bellRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="relative w-10 h-10 flex items-center justify-center hover:bg-gold/20 rounded-full transition-colors p-0 m-0"
                    title={t('notifications')}
                >
                    <Image
                        src="/assets/images/notification.svg"
                        alt={t('notifications')}
                        width={20}
                        height={20}
                        className="w-5 h-5"
                    />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>

                {/* القائمة المنسدلة - عرض w-44 (176px) */}
                {isOpen && (
                    <div
                        className="absolute top-full mt-2 w-44 bg-[#1a1a1e] border border-gold/30 rounded-xl shadow-2xl z-[99999] inset-inline-end-0"
                        style={{ maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}
                    >
                        <div className="p-2 border-b border-silver/20 flex justify-between items-center sticky top-0 bg-[#1a1a1e]">
                            <h3 className="text-gold font-alata text-xs">
                                {t('notifications')}
                            </h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-[10px] text-silver hover:text-gold transition-colors"
                                >
                                    {t('markAllAsRead')}
                                </button>
                            )}
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            {loading ? (
                                <div className="p-3 text-center text-silver/60 text-xs">
                                    {t('loading')}
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="p-3 text-center text-silver/60 text-xs">
                                    {t('noNotifications')}
                                </div>
                            ) : (
                                notifications.map((notif) => (
                                    <button
                                        key={notif.id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`w-full text-right p-2 border-b border-silver/10 last:border-0 hover:bg-gold/20 transition-colors ${!notif.is_read ? 'bg-gold/5' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-1.5">
                                            <div className={`mt-1 w-1.5 h-1.5 rounded-full ${notif.type === 'success' ? 'bg-green-500' :
                                                notif.type === 'error' ? 'bg-red-500' :
                                                    notif.type === 'warning' ? 'bg-yellow-500' :
                                                        'bg-blue-500'
                                                }`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-xs font-semibold truncate">
                                                    {notif.title}
                                                </p>
                                                <p className="text-silver/70 text-[10px] truncate">
                                                    {notif.message}
                                                </p>
                                                <p className="text-silver/50 text-[8px] mt-0.5">
                                                    {new Date(notif.created_at).toLocaleDateString(
                                                        document.dir === 'rtl' ? 'ar-EG' : 'en-US',
                                                        { hour: '2-digit', minute: '2-digit' }
                                                    )}
                                                </p>
                                            </div>
                                            {!notif.is_read && (
                                                <span className="w-1.5 h-1.5 bg-gold rounded-full" />
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {showModal && selectedNotification && (
                <NotificationModal
                    notification={selectedNotification}
                    onClose={handleModalClose}
                />
            )}
        </>
    );
}