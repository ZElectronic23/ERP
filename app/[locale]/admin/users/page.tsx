'use client';

import { useState, useEffect, useRef, use } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import WeatherPopup from '@/components/WeatherPopup';
import { fetchWeatherData } from '@/lib/weather';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';
import { v4 as uuidv4 } from 'uuid';
import imageCompression from 'browser-image-compression';
import { useRouter, usePathname } from 'next/navigation';

const USER_TYPES = [
    { value: 'employee' },
    { value: 'partner' },
    { value: 'client' },
];

const USER_ROLES = [
    { value: 'admin', type: 'employee' },
    { value: 'manager', type: 'employee' },
    { value: 'employee', type: 'employee' },
    { value: 'ceo', type: 'employee' },
    { value: 'tech_partner', type: 'partner' },
    { value: 'financial_partner', type: 'partner' },
    { value: 'regular_client', type: 'client' },
    { value: 'investor', type: 'partner' },
];

interface UsersPageProps {
    params: Promise<{ locale: string }>;
}

export default function UsersManagementPage({ params }: UsersPageProps) {
    const { locale } = use(params);
    const t = useTranslations();
    const router = useRouter();
    const pathname = usePathname();
    const language = locale as 'ar' | 'en';

    const [users, setUsers] = useState<any[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [apiWorking, setApiWorking] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const modalRef = useRef<HTMLDivElement>(null);
    const viewModalRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        phone: '',
        role_key: 'employee',
        is_admin: false,
        entity_type: 'employee',
        profile_image: null as File | null,
        profile_image_url: ''
    });
    const [passwordError, setPasswordError] = useState('');
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [arabicWarning, setArabicWarning] = useState('');
    const [uploading, setUploading] = useState(false);
    const [fileSizeWarning, setFileSizeWarning] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [isWeatherOpen, setIsWeatherOpen] = useState(false);
    const [weatherData, setWeatherData] = useState<any>(null);
    const [weatherLoading, setWeatherLoading] = useState(false);

    const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, admins: 0, deleted: 0 });
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (viewModalRef.current && !viewModalRef.current.contains(event.target as Node)) {
                setViewModalOpen(false); setSelectedUser(null);
            }
            if (modalRef.current && !modalRef.current.contains(event.target as Node) && modalOpen) {
                setModalOpen(false); setEditingUser(null); resetForm();
            }
        };
        if (viewModalOpen || modalOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [viewModalOpen, modalOpen]);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        let filtered = users;
        if (filterStatus === 'active') filtered = filtered.filter(u => u.status === 'active');
        else if (filterStatus === 'inactive') filtered = filtered.filter(u => u.status === 'inactive');
        else if (filterStatus === 'deleted') filtered = filtered.filter(u => u.status === 'deleted');
        if (filterType !== 'all') filtered = filtered.filter(u => u.entity_type === filterType);
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(u =>
                (u.full_name && u.full_name.toLowerCase().includes(term)) ||
                (u.user_code && u.user_code.toLowerCase().includes(term))
            );
        }
        setFilteredUsers(filtered);
    }, [filterStatus, filterType, users, searchTerm]);

    const openWeatherPopup = async () => {
        setIsWeatherOpen(true); setWeatherLoading(true);
        try { setWeatherData(await fetchWeatherData(language)); }
        catch (error) { console.error('Weather error:', error); }
        finally { setWeatherLoading(false); }
    };

    const checkPasswordStrength = (password: string) => {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;
        return strength;
    };

    const containsArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

    const validatePassword = (password: string, confirmPassword: string): boolean => {
        if (password && password.length < 8) {
            setPasswordError(t('passwordLengthError'));
            return false;
        }
        if (password && checkPasswordStrength(password) < 3) {
            setPasswordError(t('passwordWeakError'));
            return false;
        }
        if (password !== confirmPassword) {
            setPasswordError(t('passwordMismatch'));
            return false;
        }
        setPasswordError('');
        return true;
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFormData({ ...formData, password: val });
        setPasswordStrength(checkPasswordStrength(val));
        setArabicWarning(containsArabic(val) ? t('arabicWarning') : '');
    };

    const validateForm = (): boolean => {
        const emailValid = formData.email.includes('@') && formData.email.includes('.');
        let passwordValid = true;
        if (formData.password) {
            passwordValid = formData.password.length >= 8 &&
                checkPasswordStrength(formData.password) >= 3 &&
                formData.password === formData.confirmPassword;
        }
        return emailValid && passwordValid;
    };

    const uploadImage = async (file: File): Promise<string | null> => {
        try {
            setUploading(true);
            const options = { maxSizeMB: 1, maxWidthOrHeight: 1024, useWebWorker: true };
            const compressedFile = await imageCompression(file, options);
            const fileExt = file.name.split('.').pop();
            const fileName = `${uuidv4()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, compressedFile, { cacheControl: '3600', upsert: false });
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
            return urlData.publicUrl;
        } catch (error) {
            console.error('Upload error:', error);
            setError(t('imageUploadFailed'));
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError(t('invalidImage'));
            return;
        }
        setFileSizeWarning(`${t('fileSizeWarning')} ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        const publicUrl = await uploadImage(file);
        if (publicUrl) {
            setFormData({ ...formData, profile_image_url: publicUrl });
            setFileSizeWarning('');
        }
    };

    const fetchUsers = async () => {
        setLoading(true); setError('');
        try {
            const response = await fetch('/admin/users/api');
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to fetch users');
            if (!data.users || !Array.isArray(data.users)) {
                setUsers([]); setFilteredUsers([]); setStats({ total: 0, active: 0, inactive: 0, admins: 0, deleted: 0 }); setApiWorking(false); return;
            }
            const users = data.users.map((user: any) => ({ ...user, confirmed: !!user.confirmed_at, profile_image: user.profile_image || null, status: user.status || 'active' }));
            setUsers(users); setFilteredUsers(users); setApiWorking(true);
            setStats({
                total: users.length,
                active: users.filter((u: any) => u.status === 'active').length,
                inactive: users.filter((u: any) => u.status === 'inactive').length,
                admins: users.filter((u: any) => u.is_admin).length,
                deleted: users.filter((u: any) => u.status === 'deleted').length
            });
        } catch (error: any) {
            console.error('Error fetching users:', error);
            setError(error.message || 'Error fetching users');
            setApiWorking(false); setUsers([]); setFilteredUsers([]);
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleCreateUser = async () => {
        if (!validateForm()) { setError(t('fillRequiredFields')); return; }
        setLoading(true); setError(''); setSuccess('');
        try {
            const userPassword = formData.password?.trim() ? formData.password : '123Asd!@#';
            const response = await fetch('/admin/users/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email,
                    password: userPassword,
                    entity_type: formData.entity_type,
                    language,
                    profile_image: formData.profile_image_url || null,
                    user_metadata: { full_name: formData.full_name, phone: formData.phone, role: formData.role_key, is_admin: formData.is_admin }
                })
            });
            const text = await response.text();
            if (!text) throw new Error(t('emptyResponse'));
            const data = JSON.parse(text);
            if (!response.ok) throw new Error(data.error);
            setSuccess(data.message || (language === 'ar' ? 'تم إنشاء المستخدم بنجاح' : 'User created successfully'));
            await fetchUsers(); setModalOpen(false); resetForm();
        } catch (error: any) {
            setError(error.message || (language === 'ar' ? 'حدث خطأ' : 'An error occurred'));
        } finally { setLoading(false); }
    };

    const handleUpdateUser = async () => {
        if (!validateForm()) { setError(t('fillRequiredFields')); return; }
        setLoading(true); setError(''); setSuccess('');
        try {
            const updateBody: any = {
                email: editingUser.email,
                entity_type: formData.entity_type,
                user_metadata: { full_name: formData.full_name, phone: formData.phone, role: formData.role_key, is_admin: formData.is_admin, profile_image: formData.profile_image_url || null }
            };
            if (formData.password?.trim()) updateBody.password = formData.password;
            const response = await fetch('/admin/users/api', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateBody) });
            const text = await response.text();
            if (!text) throw new Error(t('emptyResponse'));
            const data = JSON.parse(text);
            if (!response.ok) throw new Error(data.error);
            setSuccess(data.message || (language === 'ar' ? 'تم تحديث المستخدم بنجاح' : 'User updated successfully'));
            await fetchUsers(); setModalOpen(false); setEditingUser(null); resetForm();
        } catch (error: any) {
            setError(error.message || (language === 'ar' ? 'حدث خطأ' : 'An error occurred'));
        } finally { setLoading(false); }
    };

    const handleStatusChange = async (user: any, newStatus: string) => {
        if (!confirm(t('confirmStatusChange'))) return;
        setLoading(true); setError(''); setSuccess('');
        try {
            const response = await fetch('/admin/users/api/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, status: newStatus }) });
            const text = await response.text();
            if (!text) throw new Error(t('emptyResponse'));
            const data = JSON.parse(text);
            if (!response.ok) throw new Error(data.error);
            setSuccess(data.message || (language === 'ar' ? 'تم تغيير الحالة' : 'Status changed'));
            await fetchUsers();
        } catch (error: any) {
            setError(error.message);
        } finally { setLoading(false); }
    };

    const handleSoftDeleteUser = async (user: any) => {
        if (!confirm(t('confirmSoftDelete'))) return;
        setLoading(true); setError(''); setSuccess('');
        try {
            const response = await fetch('/admin/users/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, soft: true }) });
            const text = await response.text();
            if (!text) throw new Error(t('emptyResponse'));
            const data = JSON.parse(text);
            if (!response.ok) throw new Error(data.error);
            setSuccess(data.message || (language === 'ar' ? 'تم النقل' : 'Moved to deleted'));
            await fetchUsers();
        } catch (error: any) {
            setError(error.message);
        } finally { setLoading(false); }
    };

    const handleHardDeleteUser = async (user: any) => {
        if (!confirm(t('confirmHardDelete'))) return;
        setLoading(true); setError(''); setSuccess('');
        try {
            const response = await fetch('/admin/users/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, soft: false }) });
            const text = await response.text();
            if (!text) throw new Error(t('emptyResponse'));
            const data = JSON.parse(text);
            if (!response.ok) throw new Error(data.error);
            setSuccess(data.message || (language === 'ar' ? 'تم الحذف النهائي' : 'Permanently deleted'));
            await fetchUsers();
        } catch (error: any) {
            setError(error.message);
        } finally { setLoading(false); }
    };

    const handleRestoreUser = async (user: any) => {
        if (!confirm(t('confirmRestore'))) return;
        setLoading(true); setError(''); setSuccess('');
        try {
            const response = await fetch('/admin/users/api/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email }) });
            const text = await response.text();
            if (!text) throw new Error(t('emptyResponse'));
            const data = JSON.parse(text);
            if (!response.ok) throw new Error(data.error);
            setSuccess(data.message || (language === 'ar' ? 'تمت الاستعادة' : 'Restored'));
            await fetchUsers();
        } catch (error: any) {
            setError(error.message);
        } finally { setLoading(false); }
    };

    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); editingUser ? handleUpdateUser() : handleCreateUser(); };

    const resetForm = () => {
        setFormData({ email: '', password: '', confirmPassword: '', full_name: '', phone: '', role_key: 'employee', is_admin: false, entity_type: 'employee', profile_image: null, profile_image_url: '' });
        setPasswordError(''); setPasswordStrength(0); setArabicWarning(''); setFileSizeWarning('');
    };

    const openEditModal = (user: any) => {
        setEditingUser(user);
        setFormData({ email: user.email, password: '', confirmPassword: '', full_name: user.full_name || '', phone: user.phone || '', role_key: user.role_key || 'employee', is_admin: user.is_admin || false, entity_type: user.entity_type || 'employee', profile_image: null, profile_image_url: user.profile_image || '' });
        setModalOpen(true);
    };

    const viewUserDetails = (user: any) => { setSelectedUser(user); setViewModalOpen(true); };

    const toggleLanguage = () => {
        const newLocale = language === 'ar' ? 'en' : 'ar';
        const newPath = pathname.replace(`/${language}`, `/${newLocale}`);
        router.push(newPath);
    };

    if (!isClient) return (
        <div className="min-h-screen bg-darkwhite/70 backdrop-blur-sm flex items-center justify-center">
            <div className="text-gold">{t('loading')}</div>
        </div>
    );

    const filteredRoles = USER_ROLES.filter(role => role.type === formData.entity_type);

    return (
        <div
            className="min-h-screen p-4 md:p-6"
            style={{ backgroundImage: "url('/assets/images/BG.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
            <div className="min-h-screen bg-darkwhite/70 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-white/10">

                {/* ==================== TITLE + ADD BUTTON ==================== */}
                <div className="flex justify-between items-center mb-2">
                    <h1 className="text-2xl font-alata text-gold">{t('usersManagement')}</h1>
                    <button
                        onClick={() => { setEditingUser(null); resetForm(); setModalOpen(true); }}
                        className="group relative w-10 h-10 rounded-full bg-gold/20 backdrop-blur-sm border border-gold/30 hover:bg-gold/40 transition-all duration-300 hover:scale-110 flex items-center justify-center"
                        title={t('addUser')}
                    >
                        <Image src="/assets/images/add_user.svg" alt={t('addUser')} width={20} height={20} className="w-5 h-5 object-contain brightness-0 invert opacity-80 group-hover:opacity-100" />
                    </button>
                </div>

                {/* ==================== SEARCH BAR ==================== */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('searchByNameOrCode')}
                            className="w-full px-4 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-all pr-10"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute left-2 top-1/2 -translate-y-1/2 text-silver hover:text-gold">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                    <button className="p-2 bg-gold/20 rounded-xl text-gold hover:bg-gold hover:text-darkwhite transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                    </button>
                </div>

                {/* ==================== FILTERS ==================== */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <div className="flex items-center gap-1 p-1 bg-darkwhite/20 rounded-full">
                        {[
                            { key: 'all', label: t('all'), count: stats.total, color: 'gold' },
                            { key: 'active', label: t('active'), count: stats.active, color: 'green' },
                            { key: 'inactive', label: t('inactive'), count: stats.inactive, color: 'yellow' },
                            { key: 'deleted', label: t('deleted'), count: stats.deleted, color: 'red' },
                        ].map(({ key, label, count, color }) => (
                            <button
                                key={key}
                                onClick={() => setFilterStatus(key)}
                                className={`px-3 py-1 rounded-full text-xs transition-all flex items-center gap-1 ${filterStatus === key ? `bg-${color}-500 text-white` : `text-${color}-400 hover:bg-${color}-500/20`
                                    }`}
                            >
                                {key !== 'all' && <span className={`w-1.5 h-1.5 rounded-full bg-${color}-500`}></span>}
                                {label} ({count})
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-darkwhite/20 backdrop-blur-sm rounded-full">
                        <button onClick={() => setFilterType('all')} className={`px-3 py-1 rounded-full text-xs transition-all ${filterType === 'all' ? 'bg-gold text-darkwhite' : 'text-gold hover:bg-gold/20'}`}>
                            {t('all')}
                        </button>
                        {USER_TYPES.map(type => (
                            <button key={type.value} onClick={() => setFilterType(type.value)} className={`px-3 py-1 rounded-full text-xs transition-all ${filterType === type.value ? 'bg-gold text-darkwhite' : 'text-gold hover:bg-gold/20'}`}>
                                {t(`userType_${type.value}`)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ==================== API STATUS & MESSAGES ==================== */}
                {!apiWorking && (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                        <p className="text-yellow-400 text-sm">{t('authOffline')}</p>
                    </div>
                )}
                {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>}
                {success && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl"><p className="text-green-400 text-sm">{success}</p></div>}

                {/* ==================== USERS CARDS ==================== */}
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gold"></div>
                        <p className="text-silver text-xs mt-2">{t('loading')}</p>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-silver">{t('noUsers')}</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredUsers.map((user) => (
                            <div
                                key={user.email}
                                onClick={() => viewUserDetails(user)}
                                className={`group bg-[#2a2a2e] backdrop-blur-sm rounded-xl border p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col ${user.status === 'deleted' ? 'border-red-500/30 opacity-70' : 'border-gold/20'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="relative flex-shrink-0">
                                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gold/30 group-hover:border-gold/60 transition-colors">
                                            <Image
                                                src={user.profile_image ? `${user.profile_image}?t=${Date.now()}` : '/assets/images/user.svg'}
                                                alt={user.full_name || user.email}
                                                width={64} height={64}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-darkwhite ${user.status === 'active' ? 'bg-green-500' : user.status === 'inactive' ? 'bg-yellow-500' : 'bg-red-500'
                                            }`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-alata text-xl font-semibold truncate">{user.full_name || t('noName')}</h3>
                                        <p className="text-silver text-sm truncate mt-0.5">{user.email}</p>
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                            <span className="text-gold text-xs bg-gold/10 px-2 py-0.5 rounded-full">
                                                {t(`role_${user.role_key}`)}
                                            </span>
                                            {user.is_admin && user.status !== 'deleted' && (
                                                <span className="text-purple-400 text-xs bg-purple-500/10 px-2 py-0.5 rounded-full">
                                                    {t('admin')}
                                                </span>
                                            )}
                                            {user.status === 'deleted' && (
                                                <span className="text-red-400 text-xs bg-red-500/10 px-2 py-0.5 rounded-full">
                                                    {t('deleted')}
                                                </span>
                                            )}
                                            {user.status === 'inactive' && (
                                                <span className="text-yellow-400 text-xs bg-yellow-500/10 px-2 py-0.5 rounded-full">
                                                    {t('inactive')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* أزرار الإجراءات */}
                                <div className="mt-3 pt-2 border-t border-gold/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex justify-end gap-2 flex-wrap">
                                    {user.status === 'deleted' ? (
                                        <>
                                            <button onClick={(e) => { e.stopPropagation(); handleRestoreUser(user); }} className="px-3 py-1 bg-green-500/20 rounded-lg text-green-400 text-xs hover:bg-green-500 hover:text-white transition-colors">
                                                {t('restore')}
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleHardDeleteUser(user); }} className="px-3 py-1 bg-red-500/20 rounded-lg text-red-400 text-xs hover:bg-red-500 hover:text-white transition-colors">
                                                {t('permanentDelete')}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={(e) => { e.stopPropagation(); openEditModal(user); }} className="px-3 py-1 bg-gold/20 rounded-lg text-gold text-xs hover:bg-gold hover:text-white transition-colors">
                                                {t('edit')}
                                            </button>
                                            {user.status === 'active' ? (
                                                <button onClick={(e) => { e.stopPropagation(); handleStatusChange(user, 'inactive'); }} className="px-3 py-1 bg-yellow-500/20 rounded-lg text-yellow-400 text-xs hover:bg-yellow-500 hover:text-white transition-colors">
                                                    {t('deactivate')}
                                                </button>
                                            ) : (
                                                <button onClick={(e) => { e.stopPropagation(); handleStatusChange(user, 'active'); }} className="px-3 py-1 bg-green-500/20 rounded-lg text-green-400 text-xs hover:bg-green-500 hover:text-white transition-colors">
                                                    {t('activate')}
                                                </button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); handleSoftDeleteUser(user); }} className="px-3 py-1 bg-red-500/20 rounded-lg text-red-400 text-xs hover:bg-red-500 hover:text-white transition-colors">
                                                {t('softDelete')}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ==================== ADD/EDIT MODAL ==================== */}
                {modalOpen && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" style={{ paddingTop: '10vh' }}>
                        <div ref={modalRef} className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl border border-gold/30 p-6 shadow-2xl max-w-2xl w-full my-8">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-alata text-gold">
                                    {editingUser ? t('editUser') : t('addNewUser')}
                                </h2>
                                <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-silver/20 rounded-lg transition">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-silver">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* الصورة */}
                                <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gold/50 flex-shrink-0">
                                        <Image src={formData.profile_image_url || '/assets/images/user.svg'} alt="Profile" width={64} height={64} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <label className="block text-silver text-sm mb-1">{t('profileImage')}</label>
                                        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-gold file:text-darkwhite hover:file:bg-yellow-600" />
                                        {uploading && <p className="text-gold text-xs">{t('uploading')}</p>}
                                        {fileSizeWarning && <p className="text-red-400 text-xs">{fileSizeWarning}</p>}
                                    </div>
                                </div>

                                {/* البريد الإلكتروني */}
                                <div>
                                    <label className="block text-silver text-sm mb-1">{t('email')} *</label>
                                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={!!editingUser}
                                        className={`w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold ${editingUser ? 'opacity-50 cursor-not-allowed' : ''}`} />
                                </div>

                                {/* الاسم ورقم الهاتف */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-silver text-sm mb-1">{t('fullName')}</label>
                                        <input type="text" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold" />
                                    </div>
                                    <div>
                                        <label className="block text-silver text-sm mb-1">{t('phone')}</label>
                                        <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} dir="ltr"
                                            className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold" />
                                    </div>
                                </div>

                                {/* النوع والدور */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-silver text-sm mb-1">{t('userType')}</label>
                                        <select value={formData.entity_type} onChange={(e) => setFormData({ ...formData, entity_type: e.target.value, role_key: 'employee' })}
                                            className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold">
                                            {USER_TYPES.map(type => <option key={type.value} value={type.value}>{t(`userType_${type.value}`)}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-silver text-sm mb-1">{t('role')}</label>
                                        <select value={formData.role_key} onChange={(e) => setFormData({ ...formData, role_key: e.target.value })}
                                            className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold">
                                            {filteredRoles.map(role => <option key={role.value} value={role.value}>{t(`role_${role.value}`)}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* صلاحية المدير */}
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" id="is_admin" checked={formData.is_admin} onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })} className="w-4 h-4 accent-gold" />
                                    <label htmlFor="is_admin" className="text-silver text-sm">{t('adminPrivileges')}</label>
                                </div>

                                {/* كلمة المرور */}
                                <div>
                                    <label className="block text-silver text-sm mb-1">
                                        {t('password')} {editingUser && <span className="text-silver/50">({t('leaveEmptyToKeep')})</span>}
                                    </label>
                                    <div className="relative">
                                        <input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handlePasswordChange}
                                            className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold" />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-2 top-1/2 -translate-y-1/2 text-silver">
                                            {showPassword ? '👁️' : '👁️‍🗨️'}
                                        </button>
                                    </div>
                                    {arabicWarning && <p className="text-yellow-400 text-xs mt-1">{arabicWarning}</p>}
                                    {formData.password && <PasswordStrengthMeter strength={passwordStrength} />}
                                </div>

                                {formData.password && (
                                    <div>
                                        <label className="block text-silver text-sm mb-1">{t('confirmPassword')}</label>
                                        <div className="relative">
                                            <input type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword}
                                                onChange={(e) => { setFormData({ ...formData, confirmPassword: e.target.value }); validatePassword(formData.password, e.target.value); }}
                                                className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold" />
                                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute left-2 top-1/2 -translate-y-1/2 text-silver">
                                                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                                            </button>
                                        </div>
                                        {passwordError && <p className="text-red-400 text-xs mt-1">{passwordError}</p>}
                                    </div>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <button type="submit" disabled={loading || uploading} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-xl font-bold hover:bg-yellow-600 transition disabled:opacity-50">
                                        {loading ? t('saving') : t('save')}
                                    </button>
                                    <button type="button" onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2 bg-silver/10 rounded-xl text-silver hover:bg-silver/20 transition">
                                        {t('cancel')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ==================== VIEW USER MODAL ==================== */}
                {viewModalOpen && selectedUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div ref={viewModalRef} className="bg-[#1a1a1e]/95 rounded-2xl border border-gold/30 p-6 max-w-md w-full">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-alata text-gold">{t('userDetails')}</h2>
                                <button onClick={() => { setViewModalOpen(false); setSelectedUser(null); }} className="p-1 hover:bg-silver/20 rounded-lg transition">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-silver">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div className="flex flex-col items-center gap-3 mb-4">
                                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gold/50">
                                    <Image src={selectedUser.profile_image || '/assets/images/user.svg'} alt={selectedUser.full_name || ''} width={80} height={80} className="w-full h-full object-cover" />
                                </div>
                                <h3 className="text-white font-alata text-lg">{selectedUser.full_name || t('noName')}</h3>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between border-b border-silver/20 pb-1">
                                    <span className="text-silver">{t('email')}</span>
                                    <span className="text-white">{selectedUser.email}</span>
                                </div>
                                <div className="flex justify-between border-b border-silver/20 pb-1">
                                    <span className="text-silver">{t('phone')}</span>
                                    <span className="text-white">{selectedUser.phone || '-'}</span>
                                </div>
                                <div className="flex justify-between border-b border-silver/20 pb-1">
                                    <span className="text-silver">{t('role')}</span>
                                    <span className="text-white">{t(`role_${selectedUser.role_key}`)}</span>
                                </div>
                                <div className="flex justify-between border-b border-silver/20 pb-1">
                                    <span className="text-silver">{t('type')}</span>
                                    <span className="text-white">{t(`userType_${selectedUser.entity_type}`)}</span>
                                </div>
                                <div className="flex justify-between border-b border-silver/20 pb-1">
                                    <span className="text-silver">{t('status')}</span>
                                    <span className="text-white">{t(selectedUser.status) || selectedUser.status}</span>
                                </div>
                                <div className="flex justify-between border-b border-silver/20 pb-1">
                                    <span className="text-silver">{t('admin')}</span>
                                    <span className="text-white">{selectedUser.is_admin ? t('yes') : t('no')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <WeatherPopup isOpen={isWeatherOpen} onClose={() => setIsWeatherOpen(false)} weatherData={weatherData} loading={weatherLoading} language={language} />
        </div>
    );
}