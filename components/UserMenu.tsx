'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, usePathname } from 'next/navigation';
import EditUserModal from './modals/EditUserModal';
import { useTranslations } from 'next-intl';
import { locales } from '@/config/locales';

export default function UserMenu() {
    const t = useTranslations();
    const router = useRouter();
    const pathname = usePathname();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [editProfileModal, setEditProfileModal] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    const pathSegments = pathname?.split('/') || [];
    const currentLocale = pathSegments[1] || 'ar';
    const language: 'ar' | 'en' = locales.includes(currentLocale) ? currentLocale as 'ar' | 'en' : 'ar';

    useEffect(() => {
        const fetchCurrentUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', user.email)
                    .single();
                setCurrentUser(data);
            }
        };
        fetchCurrentUser();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push(`/${language}/login`);
    };

    const toggleLanguage = () => {
        const newLocale = language === 'ar' ? 'en' : 'ar';
        if (!locales.includes(pathSegments[1])) {
            router.push(`/${newLocale}${pathname}`);
        } else {
            const newPath = pathname.replace(`/${language}`, `/${newLocale}`);
            router.push(newPath);
        }
    };

    return (
        <>
            <div className="relative" ref={userMenuRef}>
                <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="w-10 h-10 rounded-full overflow-hidden border-2 border-gold/50 hover:border-gold transition-colors p-0 m-0"
                >
                    <Image
                        src={currentUser?.profile_image || '/assets/images/user.svg'}
                        alt="User"
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                    />
                </button>

                {showUserMenu && (
                    <div
                        className="absolute top-full mt-2 w-48 bg-[#1a1a1e] border border-gold/30 rounded-xl shadow-2xl z-[999999] inset-inline-end-0"
                        style={{ minWidth: '180px' }}
                    >
                        <div className="p-3 border-b border-silver/20">
                            <p className="text-white font-semibold text-sm truncate">
                                {currentUser?.full_name || (language === 'ar' ? 'مستخدم' : 'User')}
                            </p>
                            <p className="text-silver text-xs truncate mt-1">{currentUser?.email}</p>
                        </div>

                        <button
                            onClick={() => {
                                setShowUserMenu(false);
                                setEditProfileModal(true);
                            }}
                            className="w-full px-3 py-2 text-right text-xs text-silver hover:bg-gold/20 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                            {t('editProfile')}
                        </button>

                        <button
                            onClick={toggleLanguage}
                            className="w-full px-3 py-2 text-right text-xs text-silver hover:bg-gold/20 hover:text-white transition-colors flex items-center gap-2 border-t border-silver/10"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                            </svg>
                            {language === 'ar' ? 'English' : 'العربية'}
                        </button>

                        <button
                            onClick={handleLogout}
                            className="w-full px-3 py-2 text-right text-xs text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-2 border-t border-silver/10"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12" />
                            </svg>
                            {t('logout')}
                        </button>
                    </div>
                )}
            </div>

            {editProfileModal && currentUser && (
                <EditUserModal
                    isOpen={editProfileModal}
                    onClose={() => setEditProfileModal(false)}
                    onSuccess={() => setEditProfileModal(false)}
                    user={currentUser}
                    language={language}
                />
            )}
        </>
    );
}