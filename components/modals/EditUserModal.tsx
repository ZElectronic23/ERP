'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import imageCompression from 'browser-image-compression';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';
import { useTranslations } from 'next-intl';
import Portal from '@/components/Portal';

interface EditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    user: any;
    language?: 'ar' | 'en';
}

export default function EditUserModal({ isOpen, onClose, onSuccess, user, language = 'ar' }: EditUserModalProps) {
    const t = useTranslations();
    const modalRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        if (user) {
            setFormData({
                full_name: user.full_name || '',
                email: user.email || '',
                phone: user.phone || '',
                password: '',
                confirmPassword: '',
                profile_image_url: user.profile_image || ''
            });
        }
    }, [user]);

    if (!isOpen || !user) return null;

    const checkPasswordStrength = (password: string) => {
        let strength = 0;
        if (password.length >= 8) strength += 1;
        if (/[a-z]/.test(password)) strength += 1;
        if (/[A-Z]/.test(password)) strength += 1;
        if (/[0-9]/.test(password)) strength += 1;
        if (/[^a-zA-Z0-9]/.test(password)) strength += 1;
        return strength;
    };

    const containsArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

    const validatePassword = (password: string, confirm: string): boolean => {
        if (password && password.length < 8) {
            setPasswordError(t('passwordLengthError') || 'كلمة المرور يجب أن تكون 8 أحرف على الأقل');
            return false;
        }
        if (password && checkPasswordStrength(password) < 3) {
            setPasswordError(t('passwordWeakError') || 'كلمة المرور ضعيفة، استخدم حروف كبيرة وصغيرة وأرقام ورموز');
            return false;
        }
        if (password !== confirm) {
            setPasswordError(t('passwordMismatch') || 'كلمة المرور غير متطابقة');
            return false;
        }
        setPasswordError('');
        return true;
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFormData({ ...formData, password: val });
        setPasswordStrength(checkPasswordStrength(val));
        setArabicWarning(containsArabic(val) ? (t('arabicWarning') || 'تحذير: كلمة المرور تحتوي على أحرف عربية') : '');
    };

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
            setError(t('imageUploadFailed') || 'فشل رفع الصورة');
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError(t('invalidImage') || 'الرجاء اختيار صورة صالحة');
            return;
        }
        setFileSizeWarning(`${t('fileSizeWarning') || 'حجم الملف:'} ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        const publicUrl = await uploadImage(file);
        if (publicUrl) {
            setFormData({ ...formData, profile_image_url: publicUrl });
            setFileSizeWarning('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password && !validatePassword(formData.password, formData.confirmPassword)) {
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const updateBody: any = {
                email: user.email,
                new_email: formData.email !== user.email ? formData.email : undefined,
                entity_type: user.entity_type,
                user_metadata: {
                    full_name: formData.full_name,
                    phone: formData.phone,
                    role: user.role_key,
                    is_admin: user.is_admin,
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

            const text = await response.text();
            if (!text) throw new Error(t('emptyResponse') || 'استجابة فارغة من الخادم');
            const data = JSON.parse(text);
            if (!response.ok) throw new Error(data.error);

            setSuccess(t('updateSuccess') || 'تم تحديث البيانات بنجاح');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);
        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[999999] flex items-center justify-center p-2"
                style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            >
                <div
                    ref={modalRef}
                    className="bg-[#1a1a1e] rounded-xl shadow-2xl border border-gold/30 w-full max-w-sm max-h-[90vh] overflow-y-auto"
                >
                    <div className="flex justify-between items-center p-3 border-b border-silver/20">
                        <h2 className="text-base font-alata text-gold">{t('editProfile')}</h2>
                        <button onClick={onClose} className="p-1 hover:bg-silver/20 rounded-lg transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-silver">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-3 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gold/50 flex-shrink-0">
                                <Image
                                    src={formData.profile_image_url || '/assets/images/user.svg'}
                                    alt="Profile"
                                    width={48}
                                    height={48}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-silver text-[10px] mb-1">{t('changePicture')}</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="w-full text-[10px] text-silver file:mr-1 file:py-0.5 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:bg-gold file:text-darkwhite hover:file:bg-yellow-600 transition-colors"
                                />
                                {uploading && <p className="text-gold text-[10px] mt-1">{t('uploading')}</p>}
                                {fileSizeWarning && <p className="text-red-400 text-[10px] mt-1">{fileSizeWarning}</p>}
                            </div>
                        </div>

                        <div>
                            <label className="block text-silver text-[10px] mb-1">{t('fullName')}</label>
                            <div className="w-full px-2 py-1 bg-[#0a0a0c] border border-silver/30 rounded text-white/70 text-xs">
                                {formData.full_name}
                            </div>
                        </div>

                        <div>
                            <label className="block text-silver text-[10px] mb-1">{t('phoneNumber')}</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-2 py-1 bg-[#0a0a0c] border border-silver/30 rounded text-white text-xs focus:outline-none focus:border-gold"
                                dir="ltr"
                            />
                        </div>

                        <div>
                            <label className="block text-silver text-[10px] mb-1">{t('email')}</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                                className="w-full px-2 py-1 bg-[#0a0a0c] border border-silver/30 rounded text-white text-xs focus:outline-none focus:border-gold"
                                dir="ltr"
                            />
                            <p className="text-[8px] text-silver/50 mt-1">{t('emailChangeNote')}</p>
                        </div>

                        <div className="border-t border-silver/20 pt-2">
                            <h3 className="text-gold text-[10px] mb-1">
                                {t('changePassword')} <span className="text-silver/50">({t('optional')})</span>
                            </h3>
                            <div className="space-y-2">
                                <div>
                                    <label className="block text-silver text-[10px] mb-1">{t('newPassword')}</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={formData.password}
                                            onChange={handlePasswordChange}
                                            className="w-full px-2 py-1 bg-[#0a0a0c] border border-silver/30 rounded text-white text-xs focus:outline-none focus:border-gold"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className={`absolute top-1/2 -translate-y-1/2 ${language === 'ar' ? 'left-1' : 'right-1'} text-silver`}
                                        >
                                            {showPassword ? '👁️' : '👁️‍🗨️'}
                                        </button>
                                    </div>
                                </div>

                                {formData.password && (
                                    <div>
                                        <label className="block text-silver text-[10px] mb-1">{t('confirmPassword')}</label>
                                        <div className="relative">
                                            <input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                value={formData.confirmPassword}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, confirmPassword: e.target.value });
                                                    validatePassword(formData.password, e.target.value);
                                                }}
                                                className="w-full px-2 py-1 bg-[#0a0a0c] border border-silver/30 rounded text-white text-xs focus:outline-none focus:border-gold"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className={`absolute top-1/2 -translate-y-1/2 ${language === 'ar' ? 'left-1' : 'right-1'} text-silver`}
                                            >
                                                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {arabicWarning && <p className="text-yellow-400 text-[10px] mt-1">{arabicWarning}</p>}
                            {formData.password && <PasswordStrengthMeter strength={passwordStrength} />}
                            {passwordError && <p className="text-red-400 text-[10px] mt-1">{passwordError}</p>}
                        </div>

                        {error && <div className="p-1 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-[10px]">{error}</div>}
                        {success && <div className="p-1 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-[10px]">{success}</div>}

                        <div className="flex gap-1 pt-2 border-t border-silver/20">
                            <button type="submit" disabled={loading || uploading} className="flex-1 px-2 py-1 bg-gold text-darkwhite rounded font-bold text-xs hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                {loading ? t('saving') : t('save')}
                            </button>
                            <button type="button" onClick={onClose} className="flex-1 px-2 py-1 bg-silver/10 rounded text-silver text-xs hover:bg-silver/20 transition-colors">
                                {t('cancel')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}