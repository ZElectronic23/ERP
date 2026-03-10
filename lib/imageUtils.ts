/**
 * مكتبة معالجة وضغط الصور
 * يمكن استخدامها في أي مكان في التطبيق
 */

import imageCompression from 'browser-image-compression';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabaseClient';

/**
 * خيارات ضغط الصورة
 */
interface CompressionOptions {
    maxSizeMB?: number;           // الحجم الأقصى بالميجابايت (افتراضي: 0.5)
    maxWidthOrHeight?: number;    // العرض أو الارتفاع الأقصى (افتراضي: 800)
    useWebWorker?: boolean;       // استخدام Web Worker (افتراضي: true)
    fileType?: string;            // نوع الملف الناتج (افتراضي: image/webp)
}

/**
 * نتيجة رفع الصورة
 */
interface UploadResult {
    success: boolean;
    url?: string;
    error?: string;
    filePath?: string;
}

/**
 * ضغط الصورة
 * @param file - ملف الصورة الأصلي
 * @param options - خيارات الضغط
 * @returns Promise<File> - الملف المضغوط
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<File> {
    const defaultOptions = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 800,
        useWebWorker: true,
        fileType: 'image/webp',
    };

    const compressionOptions = { ...defaultOptions, ...options };

    try {
        const compressedFile = await imageCompression(file, compressionOptions);
        return compressedFile;
    } catch (error) {
        console.error('Error compressing image:', error);
        throw new Error('فشل ضغط الصورة');
    }
}

/**
 * رفع صورة إلى Supabase Storage
 * @param file - ملف الصورة
 * @param bucketName - اسم الـ bucket (مثال: 'avatars', 'products')
 * @param folderPath - المسار داخل الـ bucket (اختياري)
 * @param shouldCompress - هل نضغط الصورة أم لا (افتراضي: true)
 * @param compressionOptions - خيارات الضغط (اختياري)
 * @returns Promise<UploadResult>
 */
export async function uploadImage(
    file: File,
    bucketName: string,
    folderPath: string = '',
    shouldCompress: boolean = true,
    compressionOptions?: CompressionOptions
): Promise<UploadResult> {
    try {
        // التحقق من نوع الملف
        if (!file.type.startsWith('image/')) {
            return {
                success: false,
                error: 'الرجاء اختيار صورة صالحة',
            };
        }

        // ضغط الصورة إذا كان مطلوباً
        let fileToUpload = file;
        if (shouldCompress) {
            fileToUpload = await compressImage(file, compressionOptions);
        }

        // إنشاء اسم ملف فريد
        const fileExt = file.name.split('.').pop() || 'webp';
        const fileName = `${uuidv4()}.${shouldCompress ? 'webp' : fileExt}`;
        const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

        // رفع الملف
        const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, fileToUpload, {
                cacheControl: '3600',
                upsert: false,
                contentType: shouldCompress ? 'image/webp' : file.type,
            });

        if (uploadError) {
            // التحقق من نوع الخطأ
            if (uploadError.message.includes('Bucket not found')) {
                return {
                    success: false,
                    error: `Bucket "${bucketName}" غير موجود. يرجى إنشاءه من Supabase Storage`,
                };
            }
            throw uploadError;
        }

        // الحصول على الرابط العام
        const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);

        return {
            success: true,
            url: urlData.publicUrl,
            filePath,
        };
    } catch (error: any) {
        console.error('Error uploading image:', error);
        return {
            success: false,
            error: error.message || 'فشل رفع الصورة',
        };
    }
}

/**
 * حذف صورة من Supabase Storage
 * @param bucketName - اسم الـ bucket
 * @param filePath - مسار الملف
 * @returns Promise<boolean>
 */
export async function deleteImage(
    bucketName: string,
    filePath: string
): Promise<boolean> {
    try {
        const { error } = await supabase.storage
            .from(bucketName)
            .remove([filePath]);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting image:', error);
        return false;
    }
}

/**
 * التحقق من صحة حجم الصورة
 * @param file - ملف الصورة
 * @param maxSizeMB - الحجم الأقصى بالميجابايت
 * @returns boolean
 */
export function validateImageSize(file: File, maxSizeMB: number = 5): boolean {
    const fileSizeMB = file.size / 1024 / 1024;
    return fileSizeMB <= maxSizeMB;
}

/**
 * التحقق من نوع الصورة
 * @param file - ملف الصورة
 * @param allowedTypes - الأنواع المسموحة
 * @returns boolean
 */
export function validateImageType(
    file: File,
    allowedTypes: string[] = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
): boolean {
    return allowedTypes.includes(file.type);
}

/**
 * قراءة الصورة كـ Data URL للمعاينة
 * @param file - ملف الصورة
 * @returns Promise<string>
 */
export function readImageAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * دالة شاملة لرفع الصورة مع جميع المعالجات
 * @param file - ملف الصورة
 * @param bucketName - اسم الـ bucket
 * @param folderPath - المسار (اختياري)
 * @returns Promise<UploadResult>
 */
export async function uploadImageWithValidation(
    file: File,
    bucketName: string,
    folderPath: string = ''
): Promise<UploadResult> {
    // التحقق من نوع الملف
    if (!validateImageType(file)) {
        return {
            success: false,
            error: 'نوع الملف غير مدعوم. يرجى اختيار صورة (JPG, PNG, WEBP, GIF)',
        };
    }

    // التحقق من حجم الملف (قبل الضغط)
    if (!validateImageSize(file, 10)) {
        return {
            success: false,
            error: 'حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت',
        };
    }

    // رفع الصورة مع الضغط
    return await uploadImage(file, bucketName, folderPath, true);
}

/**
 * استخراج اسم الملف من الرابط
 * @param url - رابط الصورة
 * @returns string
 */
export function extractFilePathFromUrl(url: string): string | null {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        // البنية: /storage/v1/object/public/{bucket}/{path}
        const bucketIndex = pathParts.indexOf('public') + 1;
        if (bucketIndex > 0 && bucketIndex < pathParts.length) {
            return pathParts.slice(bucketIndex + 1).join('/');
        }
        return null;
    } catch (error) {
        console.error('Error extracting file path:', error);
        return null;
    }
}

/**
 * حساب حجم الملف بشكل قابل للقراءة
 * @param bytes - الحجم بالبايت
 * @returns string
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}