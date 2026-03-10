'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import PasswordStrengthMeter from './PasswordStrengthMeter';
import { v4 as uuidv4 } from 'uuid';
import imageCompression from 'browser-image-compression';

interface UserMenuProps {
    language: 'ar' | 'en';
    onLanguageToggle: () => void;
}

export default function UserMenu({ language, onLanguageToggle }: UserMenuProps) {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [editProfileModal, setEditProfileModal] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    // Edit profile form state
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
    const [fileSizeWarning, setFileSizeWarning] = useState('');
    const [profileError, setProfileError] = useState('');
    const [profileSuccess, setProfileSuccess] = useState('');
    const [profileLoading, setProfileLoading] = useState(false);

    // Fetch current user
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
                setFormData(prev => ({
                    ...prev,
                    full_name: data?.full_name || '',
                    profile_image_url: data?.profile_image || ''
                }));
            }
        };
        fetchCurrentUser();
    }, []);

    // Click outside to close menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Logout
    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    // Password strength functions
    const checkPasswordStrength = (password: string) => {
        let strength = 0;
        if (password.length >= 8) strength += 1;
        if (/[a-z]/.test(password)) strength += 1;
        if (/[A-Z]/.test(password)) strength += 1;
        if (/[0-9]/.test(password)) strength += 1;
        if (/[^a-zA-Z0-9]/.test(password)) strength += 1;
        return strength;
    };

    const containsArabic = (text: string) => {
        const arabicRegex = /[\u0600-\u06FF]/;
        return arabicRegex.test(text);
    };

    const validatePassword = (password: string, confirm: string): boolean => {
        if (password && password.length < 8) {
            setPasswordError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
            return false;
        }
        if (password && checkPasswordStrength(password) < 3) {
            setPasswordError('كلمة المرور ضعيفة، استخدم حروف كبيرة وصغيرة وأرقام ورموز');
            return false;
        }
        if (password !== confirm) {
            setPasswordError('كلمة المرور غير متطابقة');
            return false;
        }
        setPasswordError('');
        return true;
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFormData({ ...formData, password: val });
        setPasswordStrength(checkPasswordStrength(val));
        if (containsArabic(val)) {
            setArabicWarning('تحذير: كلمة المرور تحتوي على أحرف عربية');
        } else {
            setArabicWarning('');
        }
    };

    // Upload image
    const uploadImage = async (file: File): Promise<string | null> => {
        try {
            setUploading(true);
            const options = { maxSizeMB: 1, maxWidthOrHeight: 1024, useWebWorker: true };
            const compressedFile = await imageCompression(file, options);
            const fileExt = file.name.split('.').pop();
            const fileName = `${uuidv4()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, compressedFile, { cacheControl: '3600', upsert: false });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
            return urlData.publicUrl;
        } catch (error) {
            console.error('Error uploading image:', error);
            setProfileError('فشل رفع الصورة');
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setProfileError('الرجاء اختيار صورة صالحة');
            return;
        }
        setFileSizeWarning(`حجم الملف: ${(file.size / 1024 / 1024).toFixed(2)} ميجابايت - سيتم ضغطه`);
        const publicUrl = await uploadImage(file);
        if (publicUrl) {
            setFormData({ ...formData, profile_image_url: publicUrl });
            setFileSizeWarning('');
        }
    };

    // Update profile
    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password && !validatePassword(formData.password, formData.confirmPassword)) {
            return;
        }

        setProfileLoading(true);
        setProfileError('');
        setProfileSuccess('');

        try {
            const updateBody: any = {
                email: currentUser.email,
                entity_type: currentUser.entity_type,
                user_metadata: {
                    full_name: formData.full_name,
                    role: currentUser.role_key,
                    is_admin: currentUser.is_admin,
                    profile_image: formData.profile_image_url || null
                }
            };
            if (formData.password && formData.password.trim() !== '') {
                updateBody.password = formData.password;
            }

            const response = await fetch('/admin/users/api', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateBody)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setProfileSuccess(language === 'ar' ? 'تم تحديث البيانات بنجاح' : 'Profile updated successfully');
            setCurrentUser((prev: any) => ({
                ...prev,
                full_name: formData.full_name,
                profile_image: formData.profile_image_url
            }));
            setTimeout(() => {
                setEditProfileModal(false);
                setProfileSuccess('');
            }, 1500);
        } catch (error: any) {
            setProfileError(error.message);
        } finally {
            setProfileLoading(false);
        }
    };

    return (
        <>
            <div className="relative" ref={userMenuRef}>
                <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="w-10 h-10 rounded-full overflow-hidden border-2 border-gold/50 hover:border-gold transition-colors"
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
                        className={`absolute top-full mt-2 w-56 bg-[#1a1a1e] border border-gold/30 rounded-xl shadow-xl z-[1000] ${language === 'ar' ? 'left-0' : 'right-0'
                            }`}
                    >
                        <div className="p-3 border-b border-silver/20">
                            <p className="text-white text-sm font-semibold truncate">{currentUser?.full_name || 'User'}</p>
                            <p className="text-silver text-xs truncate">{currentUser?.email}</p>
                        </div>
                        <button
                            onClick={() => {
                                setShowUserMenu(false);
                                setEditProfileModal(true);
                            }}
                            className="w-full px-4 py-2 text-right text-sm text-silver hover:bg-gold/20 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                            {language === 'ar' ? 'تعديل البيانات' : 'Edit Profile'}
                        </button>
                        <button
                            onClick={handleLogout}
                            className="w-full px-4 py-2 text-right text-sm text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12" />
                            </svg>
                            {language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
                        </button>
                    </div>
                )}
            </div>

            {/* Edit Profile Modal */}
            {editProfileModal && currentUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-[#1a1a1e]/95 rounded-2xl border border-gold/30 p-6 max-w-md w-full">
                        <h2 className="text-lg font-alata text-gold mb-4">
                            {language === 'ar' ? 'تعديل بياناتي' : 'Edit Profile'}
                        </h2>

                        {profileError && <div className="mb-3 p-2 bg-red-500/10 text-red-400 text-xs rounded">{profileError}</div>}
                        {profileSuccess && <div className="mb-3 p-2 bg-green-500/10 text-green-400 text-xs rounded">{profileSuccess}</div>}

                        <form onSubmit={handleProfileUpdate} className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gold/50">
                                    <Image
                                        src={formData.profile_image_url || '/assets/images/user.svg'}
                                        alt="Profile"
                                        width={64}
                                        height={64}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="text-xs text-silver file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:bg-gold file:text-darkwhite"
                                    />
                                    {uploading && <p className="text-gold text-xs mt-1">جاري الرفع...</p>}
                                    {fileSizeWarning && <p className="text-red-400 text-xs mt-1">{fileSizeWarning}</p>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-silver text-sm mb-1">
                                    {language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                                </label>
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold"
                                />
                            </div>

                            <div>
                                <label className="block text-silver text-sm mb-1">Email</label>
                                <input
                                    type="email"
                                    value={currentUser.email}
                                    disabled
                                    className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white/50 text-sm cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-silver text-sm mb-1">
                                    {language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'} ({language === 'ar' ? 'اختياري' : 'Optional'})
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={handlePasswordChange}
                                        className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 text-silver"
                                    >
                                        {showPassword ? '👁️' : '👁️‍🗨️'}
                                    </button>
                                </div>
                                {arabicWarning && <p className="text-yellow-400 text-xs mt-1">{arabicWarning}</p>}
                                {formData.password && <PasswordStrengthMeter strength={passwordStrength} />}
                            </div>

                            {formData.password && (
                                <div>
                                    <label className="block text-silver text-sm mb-1">
                                        {language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={formData.confirmPassword}
                                            onChange={(e) => {
                                                setFormData({ ...formData, confirmPassword: e.target.value });
                                                validatePassword(formData.password, e.target.value);
                                            }}
                                            className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 text-silver"
                                        >
                                            {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                                        </button>
                                    </div>
                                    {passwordError && <p className="text-red-400 text-xs mt-1">{passwordError}</p>}
                                </div>
                            )}

                            <div className="flex gap-2 pt-4">
                                <button
                                    type="submit"
                                    disabled={profileLoading || uploading}
                                    className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-xl font-bold hover:bg-yellow-600 transition-colors disabled:opacity-50"
                                >
                                    {profileLoading ? (language === 'ar' ? 'جاري...' : 'Saving...') : (language === 'ar' ? 'حفظ' : 'Save')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditProfileModal(false)}
                                    className="flex-1 px-4 py-2 bg-silver/20 text-white rounded-xl hover:bg-silver/40 transition-colors"
                                >
                                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}