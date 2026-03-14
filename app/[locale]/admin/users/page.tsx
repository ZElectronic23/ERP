'use client';

import { useState, useEffect, useRef, use } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import WeatherPopup from '@/components/WeatherPopup';
import { fetchWeatherData } from '@/lib/weather';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';
import UserMenu from '@/components/UserMenu';
import Header from '@/components/Header'; // ✅ استخدام الهيدر الموحد
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

    const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, admins: 0, deleted: 0 });
    const [isClient, setIsClient] = useState(false);
    const [isWeatherOpen, setIsWeatherOpen] = useState(false);
    const [weatherData, setWeatherData] = useState<any>(null);
    const [weatherLoading, setWeatherLoading] = useState(false);

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

    if (!isClient) return (
        <div className="min-h-screen bg-darkwhite/70 backdrop-blur-sm flex items-center justify-center">
            <div className="text-gold">{t('loading')}</div>
        </div>
    );

    const filteredRoles = USER_ROLES.filter(role => role.type === formData.entity_type);

    return (
        <div
            className="min-h-screen"
            style={{ backgroundImage: "url('/assets/images/BG.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
            <Header /> {/* ✅ استخدام الهيدر الموحد */}

            <div className="p-4 md:p-6">
                <div className="bg-darkwhite/70 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-white/10">
                    {/* باقي المحتوى (بحث، فلاتر، بطاقات المستخدمين، modals) */}
                    {/* ... يبقى كما هو دون تغيير ... */}
                </div>
            </div>

            <WeatherPopup isOpen={isWeatherOpen} onClose={() => setIsWeatherOpen(false)} weatherData={weatherData} loading={weatherLoading} language={language} />
        </div>
    );
}