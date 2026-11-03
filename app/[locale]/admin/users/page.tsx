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
import PermissionsModal from '@/components/PermissionsModal';

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
    const [permUser, setPermUser] = useState<any>(null);
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

    // ========== تعديل الـ fetch ==========
    const fetchUsers = async () => {
        setLoading(true); setError('');
        try {
            const response = await fetch('/api/admin/users');
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
            const response = await fetch('/api/admin/users', {
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
            const response = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateBody)
            });
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
            const response = await fetch('/api/admin/users?action=status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, status: newStatus })
            });
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
            const response = await fetch('/api/admin/users?action=delete', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, soft: true })
            });
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
            const response = await fetch('/api/admin/users?action=delete', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, soft: false })
            });
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
            const response = await fetch('/api/admin/users?action=restore', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email })
            });
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

    const LL = (ar: string, en: string) => (language === 'ar' ? ar : en);
    const TYPE_LABEL: Record<string, { ar: string; en: string }> = { employee: { ar: 'موظف', en: 'Employee' }, partner: { ar: 'شريك', en: 'Partner' }, client: { ar: 'عميل', en: 'Client' } };
    const ROLE_LABEL: Record<string, { ar: string; en: string }> = {
        ceo: { ar: 'المدير التنفيذي', en: 'CEO' }, admin: { ar: 'مدير نظام', en: 'Admin' }, manager: { ar: 'مدير', en: 'Manager' }, employee: { ar: 'موظف', en: 'Employee' },
        tech_partner: { ar: 'شريك فني', en: 'Tech Partner' }, financial_partner: { ar: 'شريك مالي', en: 'Financial Partner' }, investor: { ar: 'مستثمر', en: 'Investor' }, regular_client: { ar: 'عميل', en: 'Client' },
    };
    const field = 'w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white placeholder-silver/50 focus:outline-none focus:border-gold text-sm';
    const lbl = 'block text-silver mb-1 text-xs';

    return (
        <div className="min-h-screen p-4 md:p-6" style={{ backgroundImage: "url('/assets/images/BG.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="bg-black/50 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#DBA935]">{LL('المستخدمون والصلاحيات', 'Users & Permissions')}</h1>
                        <p className="text-[#C0C0C0] text-sm mt-1">{LL(`إجمالي ${filteredUsers.length} مستخدم`, `${filteredUsers.length} users`)}</p>
                    </div>
                    <button onClick={() => { resetForm(); setEditingUser(null); setModalOpen(true); }} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm">{LL('+ مستخدم جديد', '+ New User')}</button>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={LL('بحث بالاسم أو البريد...', 'Search name/email...')} className="flex-1 min-w-[160px] px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white placeholder-silver/50 focus:outline-none focus:border-gold text-sm" />
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white text-sm">
                        <option value="all">{LL('كل الأنواع', 'All types')}</option>
                        {USER_TYPES.map(ty => <option key={ty.value} value={ty.value}>{LL(TYPE_LABEL[ty.value].ar, TYPE_LABEL[ty.value].en)}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white text-sm">
                        <option value="all">{LL('كل الحالات', 'All statuses')}</option>
                        <option value="active">{LL('نشط', 'Active')}</option>
                        <option value="inactive">{LL('غير نشط', 'Inactive')}</option>
                        <option value="deleted">{LL('محذوف', 'Deleted')}</option>
                    </select>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                    <table className="w-full text-sm" style={{ minWidth: '760px' }}>
                        <thead><tr className="bg-[#242428] text-[#DBA935]/90">
                            {[LL('الاسم', 'Name'), LL('البريد', 'Email'), LL('التصنيف', 'Type'), LL('الدور', 'Role'), LL('الحالة', 'Status'), LL('الإجراءات', 'Actions')].map((h, i) => <th key={i} className="py-2.5 px-3 text-start font-semibold border-b border-[#DBA935]/20 whitespace-nowrap">{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {loading ? <tr><td colSpan={6} className="text-center py-10 text-[#C0C0C0]">{LL('جارٍ التحميل...', 'Loading...')}</td></tr>
                                : filteredUsers.length === 0 ? <tr><td colSpan={6} className="text-center py-10 text-[#C0C0C0]">{LL('لا يوجد مستخدمون', 'No users')}</td></tr>
                                    : filteredUsers.map((u: any) => (
                                        <tr key={u.entity_id || u.id} className="odd:bg-white/[0.02] border-b border-[#3E3B3F]/60 text-white">
                                            <td className="py-2 px-3 whitespace-nowrap">{u.full_name || '—'}</td>
                                            <td className="py-2 px-3 whitespace-nowrap" dir="ltr">{u.email}</td>
                                            <td className="py-2 px-3 whitespace-nowrap">{LL(TYPE_LABEL[u.entity_type]?.ar || u.entity_type || '—', TYPE_LABEL[u.entity_type]?.en || u.entity_type || '—')}</td>
                                            <td className="py-2 px-3 whitespace-nowrap">{LL(ROLE_LABEL[u.role_key]?.ar || u.role_key || '—', ROLE_LABEL[u.role_key]?.en || u.role_key || '—')}{u.is_admin ? ' ★' : ''}</td>
                                            <td className="py-2 px-3 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full text-xs ${u.status === 'active' ? 'bg-green-500/20 text-green-400' : u.status === 'deleted' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-300'}`}>{LL(u.status === 'active' ? 'نشط' : u.status === 'deleted' ? 'محذوف' : 'غير نشط', u.status || 'inactive')}</span></td>
                                            <td className="py-2 px-3 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-3">
                                                    <button onClick={() => viewUserDetails(u)} className="text-[#C0C0C0] hover:text-white hover:underline">{LL('عرض', 'View')}</button>
                                                    <button onClick={() => openEditModal(u)} className="text-[#DBA935] hover:underline">{LL('تعديل', 'Edit')}</button>
                                                    <button onClick={() => setPermUser(u)} className="text-blue-300 hover:underline">{LL('الصلاحيات', 'Permissions')}</button>
                                                    {u.status === 'deleted'
                                                        ? <button onClick={() => handleRestoreUser(u)} className="text-green-400 hover:underline">{LL('استعادة', 'Restore')}</button>
                                                        : <button onClick={() => handleSoftDeleteUser(u)} className="text-red-400 hover:underline">{LL('حذف', 'Delete')}</button>}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create / Edit modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={() => { setModalOpen(false); setEditingUser(null); }} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                    <form onSubmit={handleSubmit} className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]">
                            <h2 className="text-lg font-alata text-gold">{editingUser ? LL('تعديل مستخدم', 'Edit User') : LL('مستخدم جديد', 'New User')}</h2>
                            <button type="button" onClick={() => { setModalOpen(false); setEditingUser(null); }} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2"><label className={lbl}>{LL('الاسم الكامل', 'Full name')} *</label><input value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} className={field} required /></div>
                            <div><label className={lbl}>{LL('البريد', 'Email')} *</label><input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className={field} dir="ltr" required disabled={!!editingUser} /></div>
                            <div><label className={lbl}>{LL('الهاتف', 'Phone')}</label><input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className={field} dir="ltr" /></div>
                            <>
                                <div><label className={lbl}>{LL('كلمة المرور', 'Password')} {editingUser ? '' : '*'}</label><input type="password" value={formData.password} onChange={handlePasswordChange} className={field} dir="ltr" autoComplete="new-password" placeholder={editingUser ? LL('اتركها فارغة للإبقاء على الحالية', 'Leave blank to keep current') : ''} /></div>
                                <div><label className={lbl}>{LL('تأكيد كلمة المرور', 'Confirm password')} {editingUser ? '' : '*'}</label><input type="password" value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} className={field} dir="ltr" autoComplete="new-password" /></div>
                                {formData.password && <div className="sm:col-span-2"><PasswordStrengthMeter strength={passwordStrength} /></div>}
                                {editingUser && <p className="sm:col-span-2 text-silver/50 text-[11px] -mt-1">{LL('لتغيير كلمة مرور هذا المستخدم اكتب كلمة جديدة؛ غير ذلك اتركها فارغة.', 'To change this user’s password type a new one; otherwise leave it blank.')}</p>}
                            </>
                            <div><label className={lbl}>{LL('التصنيف', 'Type')}</label>
                                <select value={formData.entity_type} onChange={e => setFormData({ ...formData, entity_type: e.target.value, role_key: USER_ROLES.find(r => r.type === e.target.value)?.value || 'employee' })} className={field}>
                                    {USER_TYPES.map(ty => <option key={ty.value} value={ty.value}>{LL(TYPE_LABEL[ty.value].ar, TYPE_LABEL[ty.value].en)}</option>)}
                                </select>
                            </div>
                            <div><label className={lbl}>{LL('الدور', 'Role')}</label>
                                <select value={formData.role_key} onChange={e => setFormData({ ...formData, role_key: e.target.value })} className={field}>
                                    {filteredRoles.map(r => <option key={r.value} value={r.value}>{LL(ROLE_LABEL[r.value]?.ar || r.value, ROLE_LABEL[r.value]?.en || r.value)}</option>)}
                                </select>
                            </div>
                            <label className="flex items-center gap-2 text-silver text-sm cursor-pointer sm:col-span-2"><input type="checkbox" checked={formData.is_admin} onChange={e => setFormData({ ...formData, is_admin: e.target.checked })} className="accent-[#DBA935]" />{LL('صلاحيات إدارية (Admin)', 'Administrative access')}</label>
                            {passwordError && <div className="sm:col-span-2 text-red-400 text-xs">{passwordError}</div>}
                            <div className="sm:col-span-2 flex gap-3 pt-2">
                                <button type="submit" className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold hover:bg-yellow-600 transition">{editingUser ? LL('حفظ', 'Save') : LL('إنشاء المستخدم', 'Create user')}</button>
                                <button type="button" onClick={() => { setModalOpen(false); setEditingUser(null); }} className="flex-1 px-4 py-2 bg-silver/10 rounded-lg text-silver hover:bg-silver/20 transition">{LL('إلغاء', 'Cancel')}</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* View modal */}
            {viewModalOpen && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={() => setViewModalOpen(false)} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-silver/20">
                            <h2 className="text-lg font-alata text-gold">{selectedUser.full_name}</h2>
                            <button onClick={() => setViewModalOpen(false)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-5 space-y-2 text-sm text-white">
                            <p><span className="text-silver/60">{LL('البريد', 'Email')}: </span><span dir="ltr">{selectedUser.email}</span></p>
                            <p><span className="text-silver/60">{LL('الهاتف', 'Phone')}: </span>{selectedUser.phone || '—'}</p>
                            <p><span className="text-silver/60">{LL('التصنيف', 'Type')}: </span>{LL(TYPE_LABEL[selectedUser.entity_type]?.ar || selectedUser.entity_type, TYPE_LABEL[selectedUser.entity_type]?.en || selectedUser.entity_type)}</p>
                            <p><span className="text-silver/60">{LL('الدور', 'Role')}: </span>{LL(ROLE_LABEL[selectedUser.role_key]?.ar || selectedUser.role_key, ROLE_LABEL[selectedUser.role_key]?.en || selectedUser.role_key)}</p>
                            <p><span className="text-silver/60">{LL('الحالة', 'Status')}: </span>{selectedUser.status}</p>
                            <button onClick={() => { setViewModalOpen(false); setPermUser(selectedUser); }} className="mt-3 w-full px-4 py-2 bg-[#DBA935] text-[#3E3B3F] rounded-lg font-bold text-sm hover:bg-[#DBA935]/90">{LL('إدارة الصلاحيات', 'Manage permissions')}</button>
                        </div>
                    </div>
                </div>
            )}

            {permUser && (
                <PermissionsModal userId={permUser.entity_id || permUser.id} userName={permUser.full_name || permUser.email} locale={locale} onClose={() => setPermUser(null)} />
            )}
        </div>
    );
}