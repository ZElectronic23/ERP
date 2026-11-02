'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, usePathname } from 'next/navigation';
import EditUserModal from './modals/EditUserModal';
import { useTranslations } from 'next-intl';
import { locales } from '@/config/locales';
import { buildAccess } from '@/lib/auth/access';

export default function UserMenu() {
    const t = useTranslations();
    const router = useRouter();
    const pathname = usePathname();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [permRows, setPermRows] = useState<{ module: string; can_view: boolean }[]>([]);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [openGroup, setOpenGroup] = useState<string | null>(null);
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
                if (data?.entity_id) {
                    const { data: perms } = await supabase
                        .from('user_permissions')
                        .select('module, can_view')
                        .eq('user_id', data.entity_id);
                    setPermRows(perms || []);
                }
            }
        };
        fetchCurrentUser();
    }, []);

    // Universal guard: a client account is confined to its own portal — redirect it away from any
    // internal page (defense-in-depth alongside RLS, the API gates, and the server page guards).
    useEffect(() => {
        if (!currentUser) return;
        const rk = (currentUser.role_key || '').toLowerCase();
        const isClient = rk === 'client' || rk === 'regular_client' || currentUser.entity_type === 'client';
        const p = pathname || '';
        if (isClient && !p.includes('/portal/client') && !p.includes('/login')) {
            router.replace(`/${language}/portal/client`);
        }
    }, [currentUser, pathname, language, router]);

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

    // ===== الإدارات (مجموعات) للتنقل السريع =====
    type NavItem = { href: string; label: { ar: string; en: string } };
    const groups: { key: string; label: { ar: string; en: string }; adminOnly?: boolean; items: NavItem[] }[] = [
        {
            key: 'sales', label: { ar: 'المبيعات والعملاء', en: 'Sales & Clients' }, items: [
                { href: 'clients', label: { ar: 'العملاء', en: 'Clients' } },
                { href: 'support', label: { ar: 'الدعم وعلاقات العملاء', en: 'Support & CRM' } },
                { href: 'documents', label: { ar: 'المستندات', en: 'Documents' } },
                { href: 'invoices', label: { ar: 'الفواتير', en: 'Invoices' } },
                { href: 'legal', label: { ar: 'الإدارة القانونية', en: 'Legal' } },
            ]
        },
        {
            key: 'ops', label: { ar: 'المشاريع والصيانة', en: 'Projects & Maintenance' }, items: [
                { href: 'approvals', label: { ar: 'الاعتمادات', en: 'Approvals' } },
                { href: 'projects', label: { ar: 'المشاريع', en: 'Projects' } },
                { href: 'surveys', label: { ar: 'المسح الفني', en: 'Technical Survey' } },
                { href: 'knowledge', label: { ar: 'مكتبة المعرفة', en: 'Knowledge Library' } },
                { href: 'maintenance', label: { ar: 'الصيانة', en: 'Maintenance' } },
            ]
        },
        {
            key: 'inventory', label: { ar: 'المخزون', en: 'Inventory' }, items: [
                { href: 'products', label: { ar: 'المنتجات والخدمات', en: 'Products & Services' } },
            ]
        },
        {
            key: 'hr', label: { ar: 'شؤون الموظفين', en: 'Human Resources' }, items: [
                { href: 'employees', label: { ar: 'الموظفون', en: 'Employees' } },
                { href: 'hr', label: { ar: 'الحضور والإجازات', en: 'Attendance & Leaves' } },
                { href: 'payroll', label: { ar: 'الرواتب', en: 'Payroll' } },
                { href: 'evaluations', label: { ar: 'التقييمات', en: 'Evaluations' } },
            ]
        },
        {
            key: 'finance', label: { ar: 'المالية', en: 'Finance' }, items: [
                { href: 'accounting', label: { ar: 'الحسابات والمالية', en: 'Accounting' } },
                { href: 'market', label: { ar: 'بيانات السوق', en: 'Market Data' } },
                { href: 'marketing', label: { ar: 'التسويق والدعاية', en: 'Marketing' } },
            ]
        },
        {
            key: 'partners', label: { ar: 'الشركاء', en: 'Partners' }, items: [
                { href: 'partners', label: { ar: 'الشركاء', en: 'Partners' } },
            ]
        },
        {
            key: 'admin', label: { ar: 'الإدارة', en: 'Administration' }, adminOnly: true, items: [
                { href: 'admin/users', label: { ar: 'المستخدمون والصلاحيات', en: 'Users & Permissions' } },
                { href: 'admin/org', label: { ar: 'الهيكل التنظيمي', en: 'Organization' } },
            ]
        },
    ];
    // Hide modules the user may not access (e.g. a technician never sees Accounting/Payroll).
    // Same access model as the dashboard; server routes/RLS remain the hard enforcement.
    const access = buildAccess(currentUser, permRows);
    const moduleOf = (href: string) => href.split('/')[0]; // 'admin/users' → 'admin'
    const visibleGroups = currentUser
        ? groups
            .filter(g => !g.adminOnly || access.isFull)
            .map(g => ({ ...g, items: g.items.filter(it => access.has(moduleOf(it.href))) }))
            .filter(g => g.items.length > 0)
        : [];

    const goTo = (href: string) => {
        setShowUserMenu(false);
        router.push(`/${language}/${href}`);
    };

    const isActive = (href: string) => pathname?.includes(`/${href}`);

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
                        className="absolute top-full mt-2 w-64 max-w-[85vw] bg-[#1a1a1e] border border-gold/30 rounded-xl shadow-2xl z-[999999] inset-inline-end-0"
                        style={{ minWidth: '224px' }}
                    >
                        <div className="p-3 border-b border-silver/20">
                            <p className="text-white font-semibold text-sm truncate">
                                {currentUser?.full_name || (language === 'ar' ? 'مستخدم' : 'User')}
                            </p>
                            <p className="text-silver text-xs truncate mt-1">{currentUser?.email}</p>
                        </div>

                        {/* ===== التنقل بين الإدارات (مجموعات) ===== */}
                        <div className="py-1 border-b border-silver/20 max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/40 scrollbar-track-transparent">
                            <button onClick={() => goTo('dashboard')} className={`w-full px-3 py-2 text-start text-xs transition-colors flex items-center gap-2 ${isActive('dashboard') ? 'bg-gold/20 text-gold' : 'text-silver hover:bg-gold/10 hover:text-white'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isActive('dashboard') ? 'bg-gold' : 'bg-silver/40'}`} />
                                {language === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
                            </button>
                            {(() => {
                                const rk = (currentUser?.role_key || '').toLowerCase();
                                const isClient = rk === 'client' || rk === 'regular_client' || currentUser?.entity_type === 'client';
                                const href = isClient ? 'portal/client' : 'portal/technician';
                                const label = language === 'ar' ? (isClient ? 'حسابي' : 'بوابتي (الفني)') : (isClient ? 'My account' : 'My portal');
                                return (
                                    <button onClick={() => goTo(href)} className={`w-full px-3 py-2 text-start text-xs transition-colors flex items-center gap-2 ${isActive(href) ? 'bg-gold/20 text-gold' : 'text-silver hover:bg-gold/10 hover:text-white'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${isActive(href) ? 'bg-gold' : 'bg-silver/40'}`} />
                                        {label}
                                    </button>
                                );
                            })()}
                            {(() => {
                                const rk = (currentUser?.role_key || '').toLowerCase();
                                const isClient = rk === 'client' || rk === 'regular_client' || currentUser?.entity_type === 'client';
                                if (isClient) return null; // clients use their own portal, not the staff calendar
                                return (
                                    <button onClick={() => goTo('calendar')} className={`w-full px-3 py-2 text-start text-xs transition-colors flex items-center gap-2 ${isActive('calendar') ? 'bg-gold/20 text-gold' : 'text-silver hover:bg-gold/10 hover:text-white'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${isActive('calendar') ? 'bg-gold' : 'bg-silver/40'}`} />
                                        {language === 'ar' ? 'تقويمي' : 'My calendar'}
                                    </button>
                                );
                            })()}
                            {visibleGroups.map(g => (
                                <div key={g.key}>
                                    <button onClick={() => setOpenGroup(openGroup === g.key ? null : g.key)}
                                        className="w-full px-3 py-2 text-start text-xs transition-colors flex items-center justify-between text-silver hover:bg-gold/10 hover:text-white">
                                        <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gold/60" />{g.label[language]}</span>
                                        <span className="text-gold/70 text-[10px]">{openGroup === g.key ? '▾' : '▸'}</span>
                                    </button>
                                    {openGroup === g.key && g.items.map(it => (
                                        <button key={it.href} onClick={() => goTo(it.href)}
                                            className={`w-full ps-7 pe-3 py-1.5 text-start text-xs transition-colors flex items-center gap-2 ${isActive(it.href) ? 'bg-gold/20 text-gold' : 'text-silver/90 hover:bg-gold/10 hover:text-white'}`}>
                                            <span className={`w-1 h-1 rounded-full ${isActive(it.href) ? 'bg-gold' : 'bg-silver/30'}`} />
                                            {it.label[language]}
                                        </button>
                                    ))}
                                </div>
                            ))}
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