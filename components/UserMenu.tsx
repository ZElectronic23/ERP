'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import PasswordStrengthMeter from './PasswordStrengthMeter';
import { uploadImageWithValidation, readImageAsDataURL, formatFileSize } from '@/lib/imageUtils';

interface UserMenuProps {
    language: 'ar' | 'en';
    onLanguageToggle: () => void;
}

const T = {
    ar: {
        editProfile: 'تعديل بياناتي',
        logout: 'تسجيل الخروج',
        fullName: 'الاسم الكامل',
        email: 'البريد الإلكتروني',
        newPassword: 'كلمة المرور الجديدة',
        confirmPassword: 'تأكيد كلمة المرور',
        optional: 'اختياري',
        save: 'حفظ',
        saving: 'جاري الحفظ...',
        cancel: 'إلغاء',
        uploading: 'جاري رفع الصورة...',
        compressing: 'جاري ضغط الصورة...',
        successMsg: 'تم تحديث البيانات بنجاح',
        arabicWarn: 'تحذير: كلمة المرور تحتوي على أحرف عربية',
        passMin: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
        passWeak: 'كلمة المرور ضعيفة — استخدم أحرف كبيرة وصغيرة وأرقام ورموز',
        passMismatch: 'كلمة المرور غير متطابقة',
        invalidImage: 'الرجاء اختيار صورة صالحة',
        uploadFail: 'فشل رفع الصورة',
        bucketErr: 'bucket "avatars" غير موجود — أنشئه من Supabase Storage',
        selectImage: 'اختر صورة',
        changeImage: 'تغيير الصورة',
        fileSize: 'حجم الملف',
    },
    en: {
        editProfile: 'Edit Profile',
        logout: 'Logout',
        fullName: 'Full Name',
        email: 'Email',
        newPassword: 'New Password',
        confirmPassword: 'Confirm Password',
        optional: 'Optional',
        save: 'Save',
        saving: 'Saving...',
        cancel: 'Cancel',
        uploading: 'Uploading...',
        compressing: 'Compressing...',
        successMsg: 'Profile updated successfully',
        arabicWarn: 'Warning: Password contains Arabic characters',
        passMin: 'Password must be at least 8 characters',
        passWeak: 'Weak password — use uppercase, lowercase, numbers & symbols',
        passMismatch: 'Passwords do not match',
        invalidImage: 'Please select a valid image',
        uploadFail: 'Image upload failed',
        bucketErr: 'Bucket "avatars" not found — create it in Supabase Storage',
        selectImage: 'Select Image',
        changeImage: 'Change Image',
        fileSize: 'File size',
    }
}

export default function UserMenu({ language }: UserMenuProps) {
    const router = useRouter();
    const tx = T[language];

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [imagePreview, setImagePreview] = useState('');

    const [formData, setFormData] = useState({
        full_name: '',
        password: '',
        confirmPassword: '',
        profile_image_url: ''
    });
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [passwordError, setPasswordError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [arabicWarning, setArabicWarning] = useState('');
    const [uploading, setUploading] = useState(false);
    const [compressing, setCompressing] = useState(false);
    const [profileError, setProfileError] = useState('');
    const [profileSuccess, setProfileSuccess] = useState('');
    const [profileLoading, setProfileLoading] = useState(false);
    const [fileSizeInfo, setFileSizeInfo] = useState('');

    const wrapperRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ===== Fetch current user =====
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('users').select('*').eq('email', user.email).single();
            if (!data) return;
            setCurrentUser(data);
            setFormData(f => ({
                ...f,
                full_name: data.full_name || '',
                profile_image_url: data.profile_image || ''
            }));
            setImagePreview(data.profile_image || '');
        };
        fetchUser();
    }, []);

    // ✅ إغلاق القائمة عند الضغط خارجها
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ✅ إغلاق الـ Modal عند الضغط خارجه
    useEffect(() => {
        if (!showModal) return;
        const handler = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                setShowModal(false);
            }
        };
        const id = setTimeout(() => document.addEventListener('mousedown', handler), 100);
        return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
    }, [showModal]);

    // ===== Logout =====
    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    // ===== Password =====
    const checkStrength = (p: string) => {
        let s = 0;
        if (p.length >= 8) s++;
        if (/[a-z]/.test(p)) s++;
        if (/[A-Z]/.test(p)) s++;
        if (/[0-9]/.test(p)) s++;
        if (/[^a-zA-Z0-9]/.test(p)) s++;
        return s;
    };

    const validatePassword = (pass: string, confirm: string) => {
        if (pass && pass.length < 8) { setPasswordError(tx.passMin); return false; }
        if (pass && checkStrength(pass) < 3) { setPasswordError(tx.passWeak); return false; }
        if (pass !== confirm) { setPasswordError(tx.passMismatch); return false; }
        setPasswordError('');
        return true;
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFormData(f => ({ ...f, password: val }));
        setPasswordStrength(checkStrength(val));
        setArabicWarning(/[\u0600-\u06FF]/.test(val) ? tx.arabicWarn : '');
    };

    // ===== Image Upload باستخدام imageUtils =====
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setProfileError('');
        setFileSizeInfo(`${tx.fileSize}: ${formatFileSize(file.size)}`);

        // ✅ Preview فوري
        try {
            const dataUrl = await readImageAsDataURL(file);
            setImagePreview(dataUrl);
        } catch (err) {
            console.error('Preview error:', err);
        }

        // ✅ رفع مع ضغط باستخدام imageUtils
        setCompressing(true);
        setUploading(true);

        const result = await uploadImageWithValidation(file, 'avatars');

        setCompressing(false);
        setUploading(false);

        if (result.success && result.url) {
            setFormData(f => ({ ...f, profile_image_url: result.url! }));
            setImagePreview(result.url);
            setFileSizeInfo('');
        } else {
            setProfileError(result.error || tx.uploadFail);
        }
    };

    // ===== Open Modal =====
    const openModal = () => {
        setShowMenu(false);
        setProfileError('');
        setProfileSuccess('');
        setPasswordError('');
        setFormData(f => ({ ...f, password: '', confirmPassword: '' }));
        setShowModal(true);
    };

    // ===== Update Profile =====
    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password && !validatePassword(formData.password, formData.confirmPassword)) return;

        setProfileLoading(true);
        setProfileError('');
        setProfileSuccess('');

        try {
            const body: any = {
                email: currentUser.email,
                entity_type: currentUser.entity_type,
                user_metadata: {
                    full_name: formData.full_name,
                    role: currentUser.role_key,
                    is_admin: currentUser.is_admin,
                    profile_image: formData.profile_image_url || null
                }
            };
            if (formData.password?.trim()) body.password = formData.password;

            const res = await fetch('/admin/users/api', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);

            setProfileSuccess(tx.successMsg);
            setCurrentUser((prev: any) => ({
                ...prev,
                full_name: formData.full_name,
                profile_image: formData.profile_image_url
            }));

            setTimeout(() => {
                setShowModal(false);
                setProfileSuccess('');
            }, 1500);
        } catch (err: any) {
            setProfileError(err.message);
        } finally {
            setProfileLoading(false);
        }
    };

    const avatarSrc = imagePreview || currentUser?.profile_image || '/assets/images/user.svg';

    return (
        <>
            {/* ===== الزر + القائمة المنسدلة ===== */}
            <div
                ref={wrapperRef}
                className="relative flex-shrink-0"
                style={{ zIndex: 99999 }}
            >
                <button
                    onClick={() => setShowMenu(p => !p)}
                    className="w-10 h-10 rounded-full overflow-hidden border-2 border-gold/50 hover:border-gold transition-colors"
                >
                    <Image
                        src={avatarSrc}
                        alt="User"
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                        unoptimized={avatarSrc.startsWith('data:')}
                    />
                </button>

                {showMenu && (
                    <div
                        className="absolute top-full mt-2 w-56 bg-[#1a1a1e] border border-gold/30 rounded-xl shadow-2xl right-0"
                        dir={language === 'ar' ? 'rtl' : 'ltr'}
                    >
                        <div className="p-3 border-b border-silver/20">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-gold/30 flex-shrink-0">
                                    <Image
                                        src={currentUser?.profile_image || '/assets/images/user.svg'}
                                        alt="User"
                                        width={32}
                                        height={32}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-white text-sm font-semibold truncate">
                                        {currentUser?.full_name || 'User'}
                                    </p>
                                    <p className="text-silver text-xs truncate">{currentUser?.email}</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={openModal}
                            className="w-full px-4 py-2.5 text-sm text-silver hover:bg-gold/20 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 flex-shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                            </svg>
                            {tx.editProfile}
                        </button>

                        <button
                            onClick={handleLogout}
                            className="w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-2 rounded-b-xl"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 flex-shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12" />
                            </svg>
                            {tx.logout}
                        </button>
                    </div>
                )}
            </div>

            {/* ==================== MODAL تعديل البيانات (كبير ووسط الشاشة) ==================== */}
            {showModal && currentUser && (
                <div
                    className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm z-[999999]"
                    dir={language === 'ar' ? 'rtl' : 'ltr'}
                >
                    <div
                        ref={modalRef}
                        className="bg-[#1a1a1e] rounded-2xl border border-gold/30 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                    >
                        {/* رأس الـ Modal */}
                        <div className="sticky top-0 bg-[#1a1a1e] flex items-center justify-between px-6 py-4 border-b border-silver/20 z-10">
                            <h2 className="text-xl font-alata text-gold">{tx.editProfile}</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-silver/20 text-silver transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* جسم الـ Modal */}
                        <form onSubmit={handleProfileUpdate} className="p-6 space-y-5">

                            {/* رسائل */}
                            {profileError && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">
                                    {profileError}
                                </div>
                            )}
                            {profileSuccess && (
                                <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl">
                                    {profileSuccess}
                                </div>
                            )}

                            {/* ===== صورة المستخدم (أكبر وأوضح) ===== */}
                            <div className="flex flex-col items-center gap-4 pb-2">
                                <div className="relative">
                                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gold/50 bg-[#0a0a0c] shadow-xl">
                                        <Image
                                            src={avatarSrc}
                                            alt="Profile"
                                            width={128}
                                            height={128}
                                            className="w-full h-full object-cover"
                                            unoptimized={avatarSrc.startsWith('data:')}
                                        />
                                    </div>
                                    {/* أيقونة الكاميرا */}
                                    <label className="absolute bottom-0 right-0 w-10 h-10 bg-gold rounded-full flex items-center justify-center cursor-pointer hover:bg-yellow-500 transition-colors shadow-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                                        </svg>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                    </label>
                                </div>

                                {/* معلومات الرفع */}
                                <div className="text-center">
                                    {compressing && (
                                        <p className="text-gold text-sm flex items-center gap-2 justify-center">
                                            <span className="inline-block w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                                            {tx.compressing}
                                        </p>
                                    )}
                                    {uploading && !compressing && (
                                        <p className="text-gold text-sm flex items-center gap-2 justify-center">
                                            <span className="inline-block w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                                            {tx.uploading}
                                        </p>
                                    )}
                                    {fileSizeInfo && !uploading && (
                                        <p className="text-silver text-xs">{fileSizeInfo}</p>
                                    )}
                                </div>
                            </div>

                            {/* الاسم */}
                            <div>
                                <label className="block text-silver text-sm mb-2 font-medium">{tx.fullName}</label>
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={e => setFormData(f => ({ ...f, full_name: e.target.value }))}
                                    className="w-full px-4 py-3 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
                                />
                            </div>

                            {/* الإيميل */}
                            <div>
                                <label className="block text-silver text-sm mb-2 font-medium">{tx.email}</label>
                                <input
                                    type="email"
                                    value={currentUser.email}
                                    disabled
                                    className="w-full px-4 py-3 bg-[#0a0a0c] border border-silver/20 rounded-xl text-white/40 text-sm cursor-not-allowed"
                                />
                            </div>

                            {/* كلمة المرور */}
                            <div>
                                <label className="block text-silver text-sm mb-2 font-medium">
                                    {tx.newPassword}
                                    <span className="text-silver/40 mx-1 font-normal">({tx.optional})</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={handlePasswordChange}
                                        dir="ltr"
                                        className="w-full px-4 py-3 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(p => !p)}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-silver hover:text-gold text-lg"
                                    >
                                        {showPassword ? '👁️' : '👁️‍🗨️'}
                                    </button>
                                </div>
                                {arabicWarning && <p className="text-yellow-400 text-xs mt-2">{arabicWarning}</p>}
                                {formData.password && <PasswordStrengthMeter strength={passwordStrength} />}
                            </div>

                            {/* تأكيد كلمة المرور */}
                            {formData.password && (
                                <div>
                                    <label className="block text-silver text-sm mb-2 font-medium">
                                        {tx.confirmPassword}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={formData.confirmPassword}
                                            onChange={e => {
                                                setFormData(f => ({ ...f, confirmPassword: e.target.value }));
                                                validatePassword(formData.password, e.target.value);
                                            }}
                                            dir="ltr"
                                            className="w-full px-4 py-3 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(p => !p)}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-silver hover:text-gold text-lg"
                                        >
                                            {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                                        </button>
                                    </div>
                                    {passwordError && <p className="text-red-400 text-xs mt-2">{passwordError}</p>}
                                </div>
                            )}

                            {/* أزرار */}
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="submit"
                                    disabled={profileLoading || uploading || compressing}
                                    className="flex-1 py-3 bg-gold text-darkwhite rounded-xl text-sm font-bold hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                >
                                    {profileLoading ? tx.saving : tx.save}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 bg-silver/10 text-silver rounded-xl text-sm hover:bg-silver/20 transition-colors border border-silver/20"
                                >
                                    {tx.cancel}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}