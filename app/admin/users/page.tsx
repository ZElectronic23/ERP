'use client';

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { translations, Language } from '@/lib/translations'
import Image from 'next/image'
import WeatherPopup from '@/components/WeatherPopup'
import { fetchWeatherData } from '@/lib/weather'
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter'
import { v4 as uuidv4 } from 'uuid'
import imageCompression from 'browser-image-compression'

// أنواع المستخدمين والأدوار من قاعدة البيانات (مع إضافة القيم القديمة)
const USER_TYPES = [
    { value: 'employee', label: 'موظف', labelEn: 'Employee' },
    { value: 'partner', label: 'شريك', labelEn: 'Partner' },
    { value: 'client', label: 'عميل', labelEn: 'Client' },
    // للتوافق مع القيم القديمة
    { value: 'P001', label: 'شريك مالي', labelEn: 'Financial Partner', type: 'partner' },
    { value: 'P002', label: 'شريك تقني', labelEn: 'Tech Partner', type: 'partner' },
]

const USER_ROLES = [
    { value: 'admin', label: 'مدير النظام', labelEn: 'Admin', type: 'employee' },
    { value: 'manager', label: 'مدير', labelEn: 'Manager', type: 'employee' },
    { value: 'employee', label: 'موظف', labelEn: 'Employee', type: 'employee' },
    { value: 'ceo', label: 'الرئيس التنفيذي', labelEn: 'CEO', type: 'employee' },
    { value: 'cto', label: 'مدير تقني', labelEn: 'CTO', type: 'employee' },
    { value: 'cfo', label: 'مدير مالي', labelEn: 'CFO', type: 'employee' },
    { value: 'hr', label: 'موارد بشرية', labelEn: 'HR', type: 'employee' },
    { value: 'tech_partner', label: 'شريك تقني', labelEn: 'Tech Partner', type: 'partner' },
    { value: 'TechPartner', label: 'شريك تقني', labelEn: 'Tech Partner', type: 'partner' }, // للتوافق
    { value: 'financial_partner', label: 'شريك مالي', labelEn: 'Financial Partner', type: 'partner' },
    { value: 'investor', label: 'مستثمر', labelEn: 'Investor', type: 'partner' },
    { value: 'regular_client', label: 'عميل عادي', labelEn: 'Regular Client', type: 'client' },
    { value: 'vip_client', label: 'عميل مميز', labelEn: 'VIP Client', type: 'client' },
    { value: 'corporate_client', label: 'عميل شركة', labelEn: 'Corporate Client', type: 'client' },
    // للتوافق مع القيم القديمة
    { value: 'CEO', label: 'الرئيس التنفيذي', labelEn: 'CEO', type: 'employee' },
    { value: 'CRM', label: 'إدارة علاقات العملاء', labelEn: 'CRM', type: 'employee' },
    { value: 'HRD', label: 'مدير موارد بشرية', labelEn: 'HR Director', type: 'employee' },
    { value: 'Technician', label: 'فني', labelEn: 'Technician', type: 'employee' },
    { value: 'Client', label: 'عميل', labelEn: 'Client', type: 'client' },
]

export default function UsersManagementPage() {

    // ==================== STATES ====================
    const [users, setUsers] = useState<any[]>([])
    const [filteredUsers, setFilteredUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)
    const [viewModalOpen, setViewModalOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState<any>(null)
    const [editingUser, setEditingUser] = useState<any>(null)
    const [apiWorking, setApiWorking] = useState(true)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [filterType, setFilterType] = useState<string>('all')
    const modalRef = useRef<HTMLDivElement>(null)
    const viewModalRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        role_key: 'employee',
        is_admin: false,
        entity_type: 'employee',
        profile_image: null as File | null,
        profile_image_url: ''
    })
    const [passwordError, setPasswordError] = useState('')
    const [passwordStrength, setPasswordStrength] = useState(0)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [arabicWarning, setArabicWarning] = useState('')
    const [uploading, setUploading] = useState(false)
    const [fileSizeWarning, setFileSizeWarning] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [useSampleFace, setUseSampleFace] = useState(false)

    // ==================== DATE AND WEATHER ====================
    const [currentTime, setCurrentTime] = useState('')
    const [currentDate, setCurrentDate] = useState('')
    const [isDateExpanded, setIsDateExpanded] = useState(false)
    const [isWeatherOpen, setIsWeatherOpen] = useState(false)
    const [weatherData, setWeatherData] = useState<any>(null)
    const [weatherLoading, setWeatherLoading] = useState(false)

    // ==================== STATISTICS ====================
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        inactive: 0,
        admins: 0,
        deleted: 0
    })

    // ==================== CLIENT SIDE CHECK ====================
    const [isClient, setIsClient] = useState(false)
    const [language, setLanguage] = useState<Language>('ar')
    const t = translations[language]

    // ==================== CLICK OUTSIDE MODAL HANDLER ====================
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (viewModalRef.current && !viewModalRef.current.contains(event.target as Node)) {
                setViewModalOpen(false)
                setSelectedUser(null)
            }
            if (modalRef.current && !modalRef.current.contains(event.target as Node) && modalOpen) {
                setModalOpen(false)
                setEditingUser(null)
                resetForm()
            }
        }

        if (viewModalOpen || modalOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [viewModalOpen, modalOpen])

    useEffect(() => {
        setIsClient(true)

        const updateDateTime = () => {
            const now = new Date()
            setCurrentTime(now.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
                hour: '2-digit',
                minute: '2-digit'
            }))
            setCurrentDate(now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }))
        }

        updateDateTime()
        const timer = setInterval(updateDateTime, 60000)

        try {
            const savedLang = localStorage.getItem('preferred-language') as Language || 'ar'
            setLanguage(savedLang)
            document.documentElement.lang = savedLang
            document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr'
        } catch (e) {
            console.log('localStorage not available')
        }

        return () => clearInterval(timer)
    }, [language])

    // ==================== APPLY FILTERS ====================
    useEffect(() => {
        let filtered = users

        if (filterStatus === 'active') {
            filtered = filtered.filter(u => u.status === 'active')
        } else if (filterStatus === 'inactive') {
            filtered = filtered.filter(u => u.status === 'inactive')
        } else if (filterStatus === 'deleted') {
            filtered = filtered.filter(u => u.status === 'deleted')
        }

        if (filterType !== 'all') {
            filtered = filtered.filter(u => u.entity_type === filterType)
        }

        setFilteredUsers(filtered)
    }, [filterStatus, filterType, users])

    // ==================== WEATHER ====================
    const openWeatherPopup = async () => {
        setIsWeatherOpen(true)
        setWeatherLoading(true)

        try {
            const data = await fetchWeatherData(language)
            setWeatherData(data)
        } catch (error) {
            console.error('Error in weather popup:', error)
        } finally {
            setWeatherLoading(false)
        }
    }

    // ==================== PASSWORD STRENGTH CHECK ====================
    const checkPasswordStrength = (password: string) => {
        let strength = 0
        if (password.length >= 8) strength += 1
        if (/[a-z]/.test(password)) strength += 1
        if (/[A-Z]/.test(password)) strength += 1
        if (/[0-9]/.test(password)) strength += 1
        if (/[^a-zA-Z0-9]/.test(password)) strength += 1
        return strength
    }

    const containsArabic = (text: string) => {
        const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
        return arabicRegex.test(text)
    }

    const validatePassword = (password: string, confirmPassword: string): boolean => {
        if (password && password.length < 8) {
            setPasswordError('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
            return false
        }
        if (password && checkPasswordStrength(password) < 3) {
            setPasswordError('كلمة المرور ضعيفة، استخدم حروف كبيرة وصغيرة وأرقام ورموز')
            return false
        }
        if (password !== confirmPassword) {
            setPasswordError('كلمة المرور غير متطابقة')
            return false
        }
        setPasswordError('')
        return true
    }

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setFormData({ ...formData, password: val })
        setPasswordStrength(checkPasswordStrength(val))
        if (containsArabic(val)) {
            setArabicWarning('تحذير: كلمة المرور تحتوي على أحرف عربية، يفضل استخدام أحرف إنجليزية وأرقام ورموز')
        } else {
            setArabicWarning('')
        }
    }

    // ==================== FORM VALIDATION ====================
    const validateForm = (): boolean => {
        if (!editingUser) {
            // حالة الإضافة: البريد الإلكتروني إلزامي، الباسورد اختياري
            const emailValid = formData.email.includes('@') && formData.email.includes('.')
            let passwordValid = true
            if (formData.password) {
                passwordValid = formData.password.length >= 8 &&
                    checkPasswordStrength(formData.password) >= 3 &&
                    formData.password === formData.confirmPassword
            }
            return emailValid && passwordValid
        } else {
            // حالة التعديل: البريد الإلكتروني إلزامي (مقفل)، الباسورد اختياري
            const emailValid = formData.email.includes('@') && formData.email.includes('.')
            let passwordValid = true
            if (formData.password) {
                passwordValid = formData.password.length >= 8 &&
                    checkPasswordStrength(formData.password) >= 3 &&
                    formData.password === formData.confirmPassword
            }
            return emailValid && passwordValid
        }
    }

    // ==================== UPLOAD IMAGE ====================
    const uploadImage = async (file: File): Promise<string | null> => {
        try {
            setUploading(true)

            const options = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1024,
                useWebWorker: true
            }

            const compressedFile = await imageCompression(file, options)
            console.log('Original size:', file.size, 'Compressed size:', compressedFile.size)

            const fileExt = file.name.split('.').pop()
            const fileName = `${uuidv4()}.${fileExt}`
            const filePath = `avatars/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, compressedFile, {
                    cacheControl: '3600',
                    upsert: false
                })

            if (uploadError) {
                console.error('Upload error:', uploadError)
                throw uploadError
            }

            const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            return urlData.publicUrl
        } catch (error) {
            console.error('Error uploading image:', error)
            setError('فشل رفع الصورة. تأكد من إعدادات التخزين.')
            return null
        } finally {
            setUploading(false)
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            setError('الرجاء اختيار صورة صالحة')
            return
        }

        setFileSizeWarning(`حجم الملف: ${(file.size / 1024 / 1024).toFixed(2)} ميجابايت - سيتم ضغطه`)

        const publicUrl = await uploadImage(file)
        if (publicUrl) {
            setFormData({ ...formData, profile_image_url: publicUrl })
            setFileSizeWarning('')
        }
    }

    // ==================== GENERATE RANDOM AVATAR ====================
    const generateRandomAvatar = () => {
        const randomSeed = Math.floor(Math.random() * 1000000)
        const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomSeed}&backgroundColor=b6e3f4`
        setFormData({ ...formData, profile_image_url: avatarUrl })
        setUseSampleFace(true)
    }

    // ==================== FETCH USERS ====================
    const fetchUsers = async () => {
        setLoading(true)
        setError('')

        try {
            console.log('Fetching users via API...')
            const response = await fetch('/admin/users/api')
            const data = await response.json()

            if (!response.ok) throw new Error(data.error || 'Failed to fetch users')

            if (!data.users || !Array.isArray(data.users)) {
                setUsers([])
                setFilteredUsers([])
                setStats({ total: 0, active: 0, inactive: 0, admins: 0, deleted: 0 })
                setApiWorking(false)
                return
            }

            const users = data.users.map((user: any) => ({
                ...user,
                confirmed: user.confirmed_at ? true : false,
                profile_image: user.profile_image || null,
                status: user.status || 'active'
            }))

            console.log('Users found:', users.length)
            setUsers(users)
            setFilteredUsers(users)
            setApiWorking(true)

            const active = users.filter((u: any) => u.status === 'active').length
            const inactive = users.filter((u: any) => u.status === 'inactive').length
            const admins = users.filter((u: any) => u.is_admin).length
            const deleted = users.filter((u: any) => u.status === 'deleted').length

            setStats({
                total: users.length,
                active,
                inactive,
                admins,
                deleted
            })

        } catch (error: any) {
            console.error('Error fetching users:', error)
            setError(error.message || 'Error fetching users')
            setApiWorking(false)
            setUsers([])
            setFilteredUsers([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    // ==================== CREATE USER ====================
    const handleCreateUser = async () => {
        // التحقق من صحة النموذج
        if (!validateForm()) {
            setError('يرجى ملء جميع الحقول المطلوبة بشكل صحيح')
            return
        }

        setLoading(true)
        setError('')
        setSuccess('')

        try {
            // استخدام الباسورد الافتراضي إذا كان الحقل فارغاً
            const userPassword = formData.password && formData.password.trim() !== ''
                ? formData.password
                : '123Asd!@#'

            const response = await fetch('/admin/users/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email,
                    password: userPassword,
                    entity_type: formData.entity_type,
                    language,
                    profile_image: formData.profile_image_url || null,
                    user_metadata: {
                        full_name: formData.full_name,
                        role: formData.role_key,
                        is_admin: formData.is_admin
                    }
                })
            })

            const text = await response.text()
            console.log('Create response text:', text)

            if (!text) {
                throw new Error('Empty response from server')
            }

            let data
            try {
                data = JSON.parse(text)
            } catch (e) {
                console.error('Failed to parse JSON:', text)
                throw new Error('Invalid JSON response from server')
            }

            if (!response.ok) throw new Error(data.error)

            setSuccess(data.message || (language === 'ar' ? 'تم إنشاء المستخدم بنجاح' : 'User created successfully'))
            await fetchUsers()
            setModalOpen(false)
            resetForm()

        } catch (error: any) {
            console.error('Create error:', error)
            setError(error.message || (language === 'ar' ? 'حدث خطأ' : 'An error occurred'))
        } finally {
            setLoading(false)
        }
    }

    // ==================== UPDATE USER ====================
    const handleUpdateUser = async () => {
        if (!validateForm()) {
            setError('يرجى ملء جميع الحقول المطلوبة بشكل صحيح')
            return
        }

        setLoading(true)
        setError('')
        setSuccess('')

        try {
            const response = await fetch('/admin/users/api', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: editingUser.email,
                    entity_type: formData.entity_type,
                    user_metadata: {
                        full_name: formData.full_name,
                        role: formData.role_key,
                        is_admin: formData.is_admin,
                        profile_image: formData.profile_image_url || null,
                        password: formData.password || undefined
                    }
                })
            })

            const text = await response.text()
            console.log('Update response text:', text)

            if (!text) {
                throw new Error('Empty response from server')
            }

            let data
            try {
                data = JSON.parse(text)
            } catch (e) {
                console.error('Failed to parse JSON:', text)
                throw new Error('Invalid JSON response from server')
            }

            if (!response.ok) throw new Error(data.error)

            setSuccess(data.message || (language === 'ar' ? 'تم تحديث المستخدم بنجاح' : 'User updated successfully'))
            await fetchUsers()
            setModalOpen(false)
            setEditingUser(null)
            resetForm()

        } catch (error: any) {
            console.error('Update error:', error)
            setError(error.message || (language === 'ar' ? 'حدث خطأ' : 'An error occurred'))
        } finally {
            setLoading(false)
        }
    }

    // ==================== UPDATE USER STATUS ====================
    const handleStatusChange = async (user: any, newStatus: string) => {
        if (!confirm(language === 'ar' ? `هل أنت متأكد من تغيير حالة المستخدم إلى ${newStatus === 'active' ? 'نشط' : newStatus === 'inactive' ? 'غير نشط' : 'محذوف'}؟` : `Are you sure you want to change user status to ${newStatus}?`)) {
            return
        }

        setLoading(true)
        setError('')
        setSuccess('')

        try {
            const response = await fetch('/admin/users/api/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    status: newStatus
                })
            })

            const text = await response.text()
            console.log('Status change response text:', text)

            if (!text) {
                throw new Error(language === 'ar' ? 'استجابة فارغة من الخادم' : 'Empty response from server')
            }

            let data
            try {
                data = JSON.parse(text)
            } catch (e) {
                console.error('Failed to parse JSON:', text)
                throw new Error(language === 'ar' ? 'خطأ في تحليل استجابة الخادم' : 'Invalid JSON response')
            }

            if (!response.ok) throw new Error(data.error || (language === 'ar' ? 'حدث خطأ' : 'An error occurred'))

            setSuccess(data.message || (language === 'ar' ? 'تم تغيير حالة المستخدم' : 'User status changed'))
            await fetchUsers()

        } catch (error: any) {
            console.error('Status change error:', error)
            setError(error.message || (language === 'ar' ? 'حدث خطأ' : 'An error occurred'))
        } finally {
            setLoading(false)
        }
    }

    // ==================== SOFT DELETE USER ====================
    const handleSoftDeleteUser = async (user: any) => {
        if (!confirm(language === 'ar' ? 'هل أنت متأكد من نقل هذا المستخدم إلى المحذوفين؟' : 'Are you sure you want to move this user to deleted?')) {
            return
        }

        setLoading(true)
        setError('')
        setSuccess('')

        try {
            console.log('Soft deleting user:', user.email)

            const response = await fetch('/admin/users/api/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    soft: true
                })
            })

            const text = await response.text()
            console.log('Delete response text:', text)

            if (!text) {
                throw new Error(language === 'ar' ? 'استجابة فارغة من الخادم' : 'Empty response from server')
            }

            let data
            try {
                data = JSON.parse(text)
            } catch (e) {
                console.error('Failed to parse JSON:', text)
                throw new Error(language === 'ar' ? 'خطأ في تحليل استجابة الخادم' : 'Invalid JSON response')
            }

            if (!response.ok) throw new Error(data.error || (language === 'ar' ? 'حدث خطأ' : 'An error occurred'))

            setSuccess(data.message || (language === 'ar' ? 'تم نقل المستخدم إلى المحذوفين' : 'User moved to deleted'))
            await fetchUsers()

        } catch (error: any) {
            console.error('Delete error:', error)
            setError(error.message || (language === 'ar' ? 'حدث خطأ في الحذف' : 'Error deleting user'))
        } finally {
            setLoading(false)
        }
    }

    // ==================== HARD DELETE USER ====================
    const handleHardDeleteUser = async (user: any) => {
        if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المستخدم نهائياً؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to permanently delete this user? This action cannot be undone.')) {
            return
        }

        setLoading(true)
        setError('')
        setSuccess('')

        try {
            console.log('Hard deleting user:', user.email)

            const response = await fetch('/admin/users/api/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    soft: false
                })
            })

            const text = await response.text()
            console.log('Delete response text:', text)

            if (!text) {
                throw new Error(language === 'ar' ? 'استجابة فارغة من الخادم' : 'Empty response from server')
            }

            let data
            try {
                data = JSON.parse(text)
            } catch (e) {
                console.error('Failed to parse JSON:', text)
                throw new Error(language === 'ar' ? 'خطأ في تحليل استجابة الخادم' : 'Invalid JSON response')
            }

            if (!response.ok) throw new Error(data.error || (language === 'ar' ? 'حدث خطأ' : 'An error occurred'))

            setSuccess(data.message || (language === 'ar' ? 'تم حذف المستخدم نهائياً' : 'User permanently deleted'))
            await fetchUsers()

        } catch (error: any) {
            console.error('Hard delete error:', error)
            setError(error.message || (language === 'ar' ? 'حدث خطأ في الحذف' : 'Error deleting user'))
        } finally {
            setLoading(false)
        }
    }

    // ==================== RESTORE USER ====================
    const handleRestoreUser = async (user: any) => {
        if (!confirm(language === 'ar' ? 'هل أنت متأكد من استعادة هذا المستخدم؟' : 'Are you sure you want to restore this user?')) {
            return
        }

        setLoading(true)
        setError('')
        setSuccess('')

        try {
            console.log('Restoring user:', user.email)

            const response = await fetch('/admin/users/api/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email
                })
            })

            const text = await response.text()
            console.log('Restore response text:', text)

            if (!text) {
                throw new Error(language === 'ar' ? 'استجابة فارغة من الخادم' : 'Empty response from server')
            }

            let data
            try {
                data = JSON.parse(text)
            } catch (e) {
                console.error('Failed to parse JSON:', text)
                throw new Error(language === 'ar' ? 'خطأ في تحليل استجابة الخادم' : 'Invalid JSON response')
            }

            if (!response.ok) throw new Error(data.error || (language === 'ar' ? 'حدث خطأ' : 'An error occurred'))

            setSuccess(data.message || (language === 'ar' ? 'تم استعادة المستخدم بنجاح' : 'User restored successfully'))
            await fetchUsers()

        } catch (error: any) {
            console.error('Restore error:', error)
            setError(error.message || (language === 'ar' ? 'حدث خطأ في الاستعادة' : 'Error restoring user'))
        } finally {
            setLoading(false)
        }
    }

    // ==================== FORM SUBMIT HANDLER ====================
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (editingUser) {
            handleUpdateUser()
        } else {
            handleCreateUser()
        }
    }

    // ==================== RESET FORM ====================
    const resetForm = () => {
        setFormData({
            email: '',
            password: '',
            confirmPassword: '',
            full_name: '',
            role_key: 'employee',
            is_admin: false,
            entity_type: 'employee',
            profile_image: null,
            profile_image_url: ''
        })
        setPasswordError('')
        setPasswordStrength(0)
        setArabicWarning('')
        setFileSizeWarning('')
        setUseSampleFace(false)
    }

    // ==================== OPEN EDIT MODAL ====================
    const openEditModal = (user: any) => {
        setEditingUser(user)
        setFormData({
            email: user.email,
            password: '',
            confirmPassword: '',
            full_name: user.full_name || '',
            role_key: user.role_key || 'employee',
            is_admin: user.is_admin || false,
            entity_type: user.entity_type || 'employee',
            profile_image: null,
            profile_image_url: user.profile_image || ''
        })
        setModalOpen(true)
    }

    // ==================== VIEW USER DETAILS ====================
    const viewUserDetails = (user: any) => {
        setSelectedUser(user)
        setViewModalOpen(true)
    }

    // ==================== TOGGLE LANGUAGE ====================
    const toggleLanguage = () => {
        const newLang = language === 'ar' ? 'en' : 'ar'
        setLanguage(newLang)
        document.documentElement.lang = newLang
        document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr'
        try {
            localStorage.setItem('preferred-language', newLang)
        } catch (e) {
            console.log('localStorage not available')
        }
    }

    if (!isClient) {
        return (
            <div className="min-h-screen bg-darkwhite/70 backdrop-blur-sm flex items-center justify-center">
                <div className="text-gold">جاري التحميل...</div>
            </div>
        )
    }

    const filteredRoles = USER_ROLES.filter(role => role.type === formData.entity_type)

    return (
        <div className="min-h-screen p-4 md:p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="min-h-screen bg-darkwhite/70 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-white/10">

                {/* ==================== HEADER ==================== */}
                <div className="relative flex justify-between items-center mb-4">
                    <div className="relative">
                        <div
                            className="relative"
                            onMouseEnter={() => setIsDateExpanded(true)}
                            onMouseLeave={() => setIsDateExpanded(false)}
                        >
                            <div className="flex items-center gap-1 text-silver cursor-pointer hover:border hover:border-gold/50 rounded-full px-2 py-1 transition-all">
                                <span suppressHydrationWarning className="text-sm md:text-base">{currentTime}</span>
                                {isDateExpanded && (
                                    <>
                                        <span className="text-xs text-silver/80">{currentDate}</span>
                                        <button
                                            onClick={openWeatherPopup}
                                            className="text-gold hover:text-yellow-500 transition-colors"
                                            title={currentDate}
                                        >
                                            <Image
                                                src="/assets/images/cloud.svg"
                                                alt="الطقس"
                                                width={20}
                                                height={20}
                                                className="w-5 h-5 object-contain"
                                                priority
                                            />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <Image
                            src="/assets/images/ERP.svg"
                            alt="ERP"
                            width={240}
                            height={240}
                            className="w-32 h-32 md:w-40 md:h-40 object-contain"
                            priority
                        />
                    </div>

                    <button
                        onClick={toggleLanguage}
                        className="px-3 py-1 rounded-full border border-gold/30 text-gold hover:bg-gold/40 hover:text-darkwhite transition-colors text-sm"
                    >
                        {language === 'ar' ? 'EN' : 'AR'}
                    </button>
                </div>

                {/* ==================== TITLE AND ADD BUTTON ==================== */}
                <div className="flex justify-between items-center mb-2">
                    <h1 className="text-2xl font-alata text-gold">
                        {language === 'ar' ? 'إدارة المستخدمين' : 'Users Management'}
                    </h1>

                    <button
                        onClick={() => {
                            setEditingUser(null)
                            resetForm()
                            setModalOpen(true)
                        }}
                        className="group relative w-10 h-10 rounded-full bg-gold/20 backdrop-blur-sm border border-gold/30 hover:bg-gold/40 transition-all duration-300 hover:scale-110 flex items-center justify-center"
                        title={language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
                    >
                        <Image
                            src="/assets/images/add_user.svg"
                            alt="Add User"
                            width={20}
                            height={20}
                            className="w-5 h-5 object-contain brightness-0 invert opacity-80 group-hover:opacity-100"
                        />
                    </button>
                </div>

                {/* ==================== FILTERS ==================== */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <div className="flex items-center gap-1 p-1 bg-darkwhite/20 rounded-full">
                        <button
                            onClick={() => setFilterStatus('all')}
                            className={`px-3 py-1 rounded-full text-xs transition-all ${filterStatus === 'all'
                                ? 'bg-gold text-darkwhite'
                                : 'text-silver hover:bg-gold/20 hover:text-gold'
                                }`}
                        >
                            {language === 'ar' ? 'الكل' : 'All'} ({stats.total})
                        </button>
                        <button
                            onClick={() => setFilterStatus('active')}
                            className={`px-3 py-1 rounded-full text-xs transition-all flex items-center gap-1 ${filterStatus === 'active'
                                ? 'bg-green-500 text-white'
                                : 'text-green-400 hover:bg-green-500/20'
                                }`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            {language === 'ar' ? 'نشط' : 'Active'} ({stats.active})
                        </button>
                        <button
                            onClick={() => setFilterStatus('inactive')}
                            className={`px-3 py-1 rounded-full text-xs transition-all flex items-center gap-1 ${filterStatus === 'inactive'
                                ? 'bg-yellow-500 text-white'
                                : 'text-yellow-400 hover:bg-yellow-500/20'
                                }`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                            {language === 'ar' ? 'غير نشط' : 'Inactive'} ({stats.inactive})
                        </button>
                        <button
                            onClick={() => setFilterStatus('deleted')}
                            className={`px-3 py-1 rounded-full text-xs transition-all flex items-center gap-1 ${filterStatus === 'deleted'
                                ? 'bg-red-500 text-white'
                                : 'text-red-400 hover:bg-red-500/20'
                                }`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            {language === 'ar' ? 'محذوف' : 'Deleted'} ({stats.deleted})
                        </button>
                    </div>

                    <div className="relative">
                        <div className="flex items-center gap-1 p-1 bg-darkwhite/20 backdrop-blur-sm rounded-full">
                            <button
                                onClick={() => setFilterType('all')}
                                className={`px-3 py-1 rounded-full text-xs transition-all ${filterType === 'all'
                                    ? 'bg-gold text-darkwhite'
                                    : 'text-gold hover:bg-gold/20'
                                    }`}
                            >
                                {language === 'ar' ? 'الكل' : 'All'}
                            </button>
                            {USER_TYPES.map(type => (
                                <button
                                    key={type.value}
                                    onClick={() => setFilterType(type.value)}
                                    className={`px-3 py-1 rounded-full text-xs transition-all ${filterType === type.value
                                        ? 'bg-gold text-darkwhite'
                                        : 'text-gold hover:bg-gold/20'
                                        }`}
                                >
                                    {language === 'ar' ? type.label : type.labelEn}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ==================== API STATUS ==================== */}
                {!apiWorking && (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                        <p className="text-yellow-400 text-sm flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            {language === 'ar'
                                ? 'Auth API غير متصل - يمكنك عرض المستخدمين فقط'
                                : 'Auth API offline - you can only view users'}
                        </p>
                    </div>
                )}

                {/* ==================== MESSAGES ==================== */}
                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}
                {success && (
                    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                        <p className="text-green-400 text-sm">{success}</p>
                    </div>
                )}

                {/* ==================== USERS CARDS ==================== */}
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gold"></div>
                        <p className="text-silver text-xs mt-2">{t.loading}</p>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-silver">
                        {language === 'ar' ? 'لا يوجد مستخدمين' : 'No users found'}
                    </div>
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
                                                width={64}
                                                height={64}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        {user.status === 'active' && (
                                            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 ring-2 ring-darkwhite" />
                                        )}
                                        {user.status === 'inactive' && (
                                            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-yellow-500 ring-2 ring-darkwhite" />
                                        )}
                                        {user.status === 'deleted' && (
                                            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 ring-2 ring-darkwhite" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-alata text-base truncate">
                                            {user.full_name || 'بدون اسم'}
                                        </h3>
                                        <p className="text-silver text-sm truncate mt-0.5">{user.email}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-gold text-xs bg-gold/10 px-2 py-0.5 rounded-full">
                                                {language === 'ar'
                                                    ? USER_ROLES.find(r => r.value === user.role_key)?.label || user.role_key
                                                    : USER_ROLES.find(r => r.value === user.role_key)?.labelEn || user.role_key}
                                            </span>
                                            {user.is_admin && user.status !== 'deleted' && (
                                                <span className="text-purple-400 text-xs bg-purple-500/10 px-2 py-0.5 rounded-full">
                                                    {language === 'ar' ? 'مدير' : 'Admin'}
                                                </span>
                                            )}
                                            {user.status === 'deleted' && (
                                                <span className="text-red-400 text-xs bg-red-500/10 px-2 py-0.5 rounded-full">
                                                    {language === 'ar' ? 'محذوف' : 'Deleted'}
                                                </span>
                                            )}
                                            {user.status === 'inactive' && (
                                                <span className="text-yellow-400 text-xs bg-yellow-500/10 px-2 py-0.5 rounded-full">
                                                    {language === 'ar' ? 'غير نشط' : 'Inactive'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-silver/50 text-[8px] mt-1">
                                            {language === 'ar'
                                                ? USER_TYPES.find(t => t.value === user.entity_type)?.label || user.entity_type
                                                : USER_TYPES.find(t => t.value === user.entity_type)?.labelEn || user.entity_type}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-3 pt-2 border-t border-gold/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex justify-end gap-2">
                                    {user.status === 'deleted' ? (
                                        <>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleRestoreUser(user)
                                                }}
                                                className="px-3 py-1 bg-green-500/20 rounded-lg text-green-400 text-xs hover:bg-green-500 hover:text-white transition-colors flex items-center gap-1"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                                </svg>
                                                {language === 'ar' ? 'استعادة' : 'Restore'}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleHardDeleteUser(user)
                                                }}
                                                className="px-3 py-1 bg-red-500/20 rounded-lg text-red-400 text-xs hover:bg-red-500 hover:text-white transition-colors flex items-center gap-1"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                                {language === 'ar' ? 'حذف نهائي' : 'Permanent Delete'}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    openEditModal(user)
                                                }}
                                                className="px-3 py-1 bg-gold/20 rounded-lg text-gold text-xs hover:bg-gold hover:text-darkwhite transition-colors flex items-center gap-1"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                </svg>
                                                {language === 'ar' ? 'تعديل' : 'Edit'}
                                            </button>
                                            {user.status === 'active' ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleStatusChange(user, 'inactive')
                                                    }}
                                                    className="px-3 py-1 bg-yellow-500/20 rounded-lg text-yellow-400 text-xs hover:bg-yellow-500 hover:text-white transition-colors flex items-center gap-1"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                    </svg>
                                                    {language === 'ar' ? 'تعطيل' : 'Deactivate'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleStatusChange(user, 'active')
                                                    }}
                                                    className="px-3 py-1 bg-green-500/20 rounded-lg text-green-400 text-xs hover:bg-green-500 hover:text-white transition-colors flex items-center gap-1"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {language === 'ar' ? 'تفعيل' : 'Activate'}
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleSoftDeleteUser(user)
                                                }}
                                                className="px-3 py-1 bg-red-500/20 rounded-lg text-red-400 text-xs hover:bg-red-500 hover:text-white transition-colors flex items-center gap-1"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                                {language === 'ar' ? 'حذف مؤقت' : 'Soft Delete'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ==================== ADD/EDIT USER MODAL ==================== */}
                {modalOpen && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" style={{ paddingTop: '10vh' }}>
                        <div
                            ref={modalRef}
                            className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl border border-gold/30 p-6 shadow-2xl max-w-2xl w-full my-8"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-alata text-gold">
                                    {editingUser
                                        ? (language === 'ar' ? 'تعديل المستخدم' : 'Edit User')
                                        : (language === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User')}
                                </h2>
                                <button
                                    onClick={() => setModalOpen(false)}
                                    className="p-1 hover:bg-silver/20 rounded-lg transition"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-silver">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* صورة المستخدم مع خيارات متعددة */}
                                <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gold/50 flex-shrink-0">
                                        <Image
                                            src={formData.profile_image_url || '/assets/images/user.svg'}
                                            alt="Profile"
                                            width={64}
                                            height={64}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <label className="block text-silver text-sm mb-1">
                                            {language === 'ar' ? 'صورة المستخدم' : 'Profile Image'}
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                accept="image/*"
                                                onChange={handleFileChange}
                                                className="flex-1 px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gold file:text-darkwhite hover:file:bg-yellow-600"
                                            />
                                            <button
                                                type="button"
                                                onClick={generateRandomAvatar}
                                                className="px-3 py-2 bg-purple-500/20 rounded-xl text-purple-400 text-sm hover:bg-purple-500 hover:text-white transition-colors"
                                            >
                                                {language === 'ar' ? 'عشوائي' : 'Random'}
                                            </button>
                                        </div>
                                        {uploading && <p className="text-gold text-xs mt-1">جاري الرفع...</p>}
                                        {fileSizeWarning && (
                                            <p className="text-red-400 text-xs mt-1">{fileSizeWarning}</p>
                                        )}
                                        <p className="text-silver/50 text-xs mt-1">
                                            {language === 'ar' ? 'اختر صورة من جهازك أو استخدم صورة عشوائية (سيتم ضغطها تلقائياً)' : 'Choose an image from your device or use a random one (will be compressed automatically)'}
                                        </p>
                                    </div>
                                </div>

                                {/* البريد الإلكتروني */}
                                <div>
                                    <label className="block text-silver text-sm mb-1">
                                        {language === 'ar' ? 'البريد الإلكتروني' : 'Email'} *
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                        disabled={!!editingUser}
                                        className={`w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-all ${editingUser ? 'opacity-50 cursor-not-allowed' : ''
                                            }`}
                                    />
                                </div>

                                {/* كلمة المرور - للإضافة فقط */}
                                {!editingUser && (
                                    <>
                                        <div>
                                            <label className="block text-silver text-sm mb-1">
                                                {language === 'ar' ? 'كلمة المرور' : 'Password'} {language === 'ar' ? '(اختياري)' : '(Optional)'}
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={formData.password}
                                                    onChange={handlePasswordChange}
                                                    placeholder={language === 'ar' ? 'اترك فارغاً للباسورد الافتراضي' : 'Leave empty for default password'}
                                                    className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-all"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className={`absolute ${language === 'ar' ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-silver hover:text-gold`}
                                                >
                                                    {showPassword ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                            {arabicWarning && (
                                                <p className="text-yellow-400 text-xs mt-1">{arabicWarning}</p>
                                            )}
                                            <PasswordStrengthMeter strength={passwordStrength} />
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
                                                            setFormData({ ...formData, confirmPassword: e.target.value })
                                                            validatePassword(formData.password, e.target.value)
                                                        }}
                                                        placeholder="********"
                                                        className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-all"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                        className={`absolute ${language === 'ar' ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-silver hover:text-gold`}
                                                    >
                                                        {showConfirmPassword ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                                            </svg>
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {passwordError && (
                                            <p className="text-red-400 text-xs">{passwordError}</p>
                                        )}
                                    </>
                                )}

                                {/* كلمة المرور - للتعديل (اختياري) */}
                                {editingUser && (
                                    <>
                                        <div>
                                            <label className="block text-silver text-sm mb-1">
                                                {language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'} {language === 'ar' ? '(اختياري)' : '(Optional)'}
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={formData.password}
                                                    onChange={handlePasswordChange}
                                                    placeholder={language === 'ar' ? 'اترك فارغاً لعدم التغيير' : 'Leave empty to keep current'}
                                                    className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-all"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className={`absolute ${language === 'ar' ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-silver hover:text-gold`}
                                                >
                                                    {showPassword ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                            {formData.password && (
                                                <>
                                                    {arabicWarning && (
                                                        <p className="text-yellow-400 text-xs mt-1">{arabicWarning}</p>
                                                    )}
                                                    <PasswordStrengthMeter strength={passwordStrength} />
                                                </>
                                            )}
                                        </div>
                                        {formData.password && (
                                            <div>
                                                <label className="block text-silver text-sm mb-1">
                                                    {language === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type={showConfirmPassword ? 'text' : 'password'}
                                                        value={formData.confirmPassword}
                                                        onChange={(e) => {
                                                            setFormData({ ...formData, confirmPassword: e.target.value })
                                                            validatePassword(formData.password, e.target.value)
                                                        }}
                                                        placeholder="********"
                                                        className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-all"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                        className={`absolute ${language === 'ar' ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-silver hover:text-gold`}
                                                    >
                                                        {showConfirmPassword ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                                            </svg>
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {passwordError && (
                                            <p className="text-red-400 text-xs">{passwordError}</p>
                                        )}
                                    </>
                                )}

                                {/* الاسم الكامل */}
                                <div>
                                    <label className="block text-silver text-sm mb-1">
                                        {language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-all"
                                    />
                                </div>

                                {/* نوع المستخدم */}
                                <div>
                                    <label className="block text-silver text-sm mb-1">
                                        {language === 'ar' ? 'نوع المستخدم' : 'User Type'}
                                    </label>
                                    <select
                                        value={formData.entity_type}
                                        onChange={(e) => {
                                            setFormData({
                                                ...formData,
                                                entity_type: e.target.value,
                                                role_key: e.target.value === 'employee' ? 'employee' :
                                                    e.target.value === 'partner' ? 'tech_partner' : 'regular_client'
                                            })
                                        }}
                                        className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-all"
                                    >
                                        {USER_TYPES.map(type => (
                                            <option key={type.value} value={type.value}>
                                                {language === 'ar' ? type.label : type.labelEn}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* الدور */}
                                <div>
                                    <label className="block text-silver text-sm mb-1">
                                        {language === 'ar' ? 'الدور' : 'Role'}
                                    </label>
                                    <select
                                        value={formData.role_key}
                                        onChange={(e) => setFormData({ ...formData, role_key: e.target.value })}
                                        className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-all"
                                    >
                                        {filteredRoles.map(role => (
                                            <option key={role.value} value={role.value}>
                                                {language === 'ar' ? role.label : role.labelEn}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* صلاحيات مدير */}
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_admin}
                                        onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
                                        className="w-4 h-4 accent-gold"
                                    />
                                    <span className="text-silver text-sm">
                                        {language === 'ar' ? 'صلاحيات مدير' : 'Admin privileges'}
                                    </span>
                                </label>

                                {/* أزرار التحكم */}
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={loading || uploading}
                                        className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-xl font-bold hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? (language === 'ar' ? 'جاري...' : 'Saving...') : (language === 'ar' ? 'حفظ' : 'Save')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setModalOpen(false)}
                                        className="flex-1 px-4 py-2 bg-silver/20 text-white rounded-xl hover:bg-silver/40 transition-colors"
                                    >
                                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* View Details Modal */}
                {viewModalOpen && selectedUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div
                            ref={viewModalRef}
                            className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl border border-gold/30 p-6 shadow-2xl max-w-md w-full"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-alata text-gold">
                                    {language === 'ar' ? 'تفاصيل المستخدم' : 'User Details'}
                                </h2>
                                <button
                                    onClick={() => {
                                        setViewModalOpen(false)
                                        setSelectedUser(null)
                                    }}
                                    className="p-1 hover:bg-silver/20 rounded-lg transition"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-silver">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-center">
                                    <div className="w-24 h-24 rounded-full overflow-hidden border-3 border-gold">
                                        <Image
                                            src={selectedUser.profile_image ? `${selectedUser.profile_image}?t=${Date.now()}` : '/assets/images/user.svg'}
                                            alt={selectedUser.full_name || selectedUser.email}
                                            width={96}
                                            height={96}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                </div>

                                <div className="text-center">
                                    {selectedUser.status === 'deleted' ? (
                                        <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">محذوف</span>
                                    ) : selectedUser.status === 'active' ? (
                                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">نشط</span>
                                    ) : (
                                        <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">غير نشط</span>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between border-b border-silver/20 pb-1">
                                        <span className="text-silver text-sm">الاسم</span>
                                        <span className="text-white text-sm">{selectedUser.full_name || '-'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-silver/20 pb-1">
                                        <span className="text-silver text-sm">البريد</span>
                                        <span className="text-white text-sm">{selectedUser.email}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-silver/20 pb-1">
                                        <span className="text-silver text-sm">نوع المستخدم</span>
                                        <span className="text-white text-sm">
                                            {language === 'ar'
                                                ? USER_TYPES.find(t => t.value === selectedUser.entity_type)?.label || selectedUser.entity_type
                                                : USER_TYPES.find(t => t.value === selectedUser.entity_type)?.labelEn || selectedUser.entity_type}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-b border-silver/20 pb-1">
                                        <span className="text-silver text-sm">الدور</span>
                                        <span className="text-white text-sm">
                                            {language === 'ar'
                                                ? USER_ROLES.find(r => r.value === selectedUser.role_key)?.label || selectedUser.role_key
                                                : USER_ROLES.find(r => r.value === selectedUser.role_key)?.labelEn || selectedUser.role_key}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-b border-silver/20 pb-1">
                                        <span className="text-silver text-sm">مدير</span>
                                        <span className="text-white text-sm">{selectedUser.is_admin ? 'نعم' : 'لا'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-silver/20 pb-1">
                                        <span className="text-silver text-sm">الحالة</span>
                                        <span className="text-white text-sm">
                                            {selectedUser.status === 'active' ? 'نشط' : selectedUser.status === 'inactive' ? 'غير نشط' : 'محذوف'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-b border-silver/20 pb-1">
                                        <span className="text-silver text-sm">آخر ظهور</span>
                                        <span className="text-white text-sm">
                                            {selectedUser.last_sign_in
                                                ? new Date(selectedUser.last_sign_in).toLocaleDateString()
                                                : '-'}
                                        </span>
                                    </div>
                                    {selectedUser.status === 'deleted' && selectedUser.deleted_at && (
                                        <div className="flex justify-between border-b border-silver/20 pb-1">
                                            <span className="text-silver text-sm">تاريخ الحذف</span>
                                            <span className="text-white text-sm">
                                                {new Date(selectedUser.deleted_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 pt-4">
                                    {selectedUser.status === 'deleted' ? (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setViewModalOpen(false)
                                                    handleRestoreUser(selectedUser)
                                                }}
                                                className="flex-1 px-4 py-2 bg-green-500/20 text-green-400 rounded-xl font-bold hover:bg-green-500 hover:text-white transition-colors"
                                            >
                                                {language === 'ar' ? 'استعادة' : 'Restore'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setViewModalOpen(false)
                                                    handleHardDeleteUser(selectedUser)
                                                }}
                                                className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-colors"
                                            >
                                                {language === 'ar' ? 'حذف نهائي' : 'Permanent Delete'}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setViewModalOpen(false)
                                                    openEditModal(selectedUser)
                                                }}
                                                className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-xl font-bold hover:bg-yellow-600 transition-colors"
                                            >
                                                {language === 'ar' ? 'تعديل' : 'Edit'}
                                            </button>
                                            {selectedUser.status === 'active' ? (
                                                <button
                                                    onClick={() => {
                                                        setViewModalOpen(false)
                                                        handleStatusChange(selectedUser, 'inactive')
                                                    }}
                                                    className="flex-1 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-xl font-bold hover:bg-yellow-500 hover:text-white transition-colors"
                                                >
                                                    {language === 'ar' ? 'تعطيل' : 'Deactivate'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setViewModalOpen(false)
                                                        handleStatusChange(selectedUser, 'active')
                                                    }}
                                                    className="flex-1 px-4 py-2 bg-green-500/20 text-green-400 rounded-xl font-bold hover:bg-green-500 hover:text-white transition-colors"
                                                >
                                                    {language === 'ar' ? 'تفعيل' : 'Activate'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setViewModalOpen(false)
                                                    handleSoftDeleteUser(selectedUser)
                                                }}
                                                className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-colors"
                                            >
                                                {language === 'ar' ? 'حذف مؤقت' : 'Soft Delete'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <WeatherPopup
                    isOpen={isWeatherOpen}
                    onClose={() => setIsWeatherOpen(false)}
                    weatherData={weatherData}
                    loading={weatherLoading}
                    language={language}
                />
            </div>
        </div>
    )
}