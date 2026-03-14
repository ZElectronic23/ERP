'use client';

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { v4 as uuidv4 } from 'uuid'
import imageCompression from 'browser-image-compression'

interface ProductModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    product?: any
    language?: 'ar' | 'en' // قد لا نحتاج إليه بعد الآن لأننا نستخدم useTranslations
}

export default function ProductModal({ isOpen, onClose, onSuccess, product, language = 'ar' }: ProductModalProps) {
    const t = useTranslations() // ✅ استخدام الترجمة

    const [loading, setLoading] = useState(false)
    const [categorySuggestions, setCategorySuggestions] = useState<string[]>([])
    const [productSuggestions, setProductSuggestions] = useState<any[]>([])
    const [formData, setFormData] = useState({
        product_id: '',
        name: '',
        category: '',
        sell_price: '',
        cost_price: '',
        stock_quantity: '0',
        unit: ''
    })
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(product?.image || null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')

    // جلب آخر كود منتج لإنشاء كود جديد تلقائي (فقط للإضافة)
    useEffect(() => {
        if (!product) {
            async function getLastProductId() {
                const { data } = await supabase
                    .from('products')
                    .select('product_id')
                    .order('product_id', { ascending: false })
                    .limit(1)

                if (data && data.length > 0) {
                    const lastId = data[0].product_id
                    const num = parseInt(lastId.replace('P', '')) + 1
                    const newId = `P${num.toString().padStart(3, '0')}`
                    setFormData({
                        product_id: newId,
                        name: '',
                        category: '',
                        sell_price: '',
                        cost_price: '',
                        stock_quantity: '0',
                        unit: ''
                    })
                } else {
                    setFormData({
                        product_id: 'P001',
                        name: '',
                        category: '',
                        sell_price: '',
                        cost_price: '',
                        stock_quantity: '0',
                        unit: ''
                    })
                }
            }
            getLastProductId()
        }
    }, [product])

    // إذا كان في product (تعديل)، نملأ البيانات
    useEffect(() => {
        if (product) {
            setFormData({
                product_id: product.product_id || '',
                name: product.name || '',
                category: product.category || '',
                sell_price: product.sell_price || '',
                cost_price: product.cost_price || '',
                stock_quantity: product.stock_quantity || '0',
                unit: product.unit || ''
            })
            setImagePreview(product.image || null)
        }
    }, [product])

    // البحث عن الفئات
    const searchCategories = async (input: string) => {
        if (input.length < 1) {
            setCategorySuggestions([])
            return
        }
        const { data } = await supabase
            .from('products')
            .select('category')
            .ilike('category', `%${input}%`)
            .not('category', 'is', null)

        const unique = [...new Set(data?.map(d => d.category))]
        setCategorySuggestions(unique.slice(0, 5))
    }

    // البحث عن المنتجات المكررة
    const checkDuplicateProduct = async (name: string) => {
        if (name.length < 2) {
            setProductSuggestions([])
            return
        }
        const { data } = await supabase
            .from('products')
            .select('product_id, name')
            .ilike('name', `%${name}%`)
            .limit(3)

        setProductSuggestions(data || [])
    }

    // رفع الصورة
    const uploadImage = async (file: File): Promise<string | null> => {
        try {
            setUploading(true)
            const options = { maxSizeMB: 1, maxWidthOrHeight: 1024, useWebWorker: true }
            const compressedFile = await imageCompression(file, options)
            const fileExt = file.name.split('.').pop()
            const fileName = `${uuidv4()}.${fileExt}`
            const filePath = `products/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('products')
                .upload(filePath, compressedFile, { cacheControl: '3600', upsert: false })

            if (uploadError) throw uploadError

            const { data: urlData } = supabase.storage.from('products').getPublicUrl(filePath)
            return urlData.publicUrl
        } catch (error) {
            console.error('Error uploading image:', error)
            setError(t('imageUploadFailed') || 'فشل رفع الصورة')
            return null
        } finally {
            setUploading(false)
        }
    }

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setError(t('invalidImage') || 'الرجاء اختيار صورة صالحة')
            return
        }

        const reader = new FileReader()
        reader.onloadend = () => {
            setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(file)
        setImageFile(file)
    }

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            let imageUrl = product?.image || null
            if (imageFile) {
                imageUrl = await uploadImage(imageFile)
                if (!imageUrl) throw new Error(t('imageUploadFailed') || 'فشل رفع الصورة')
            }

            const productData = {
                product_id: formData.product_id,
                name: formData.name,
                category: formData.category || null,
                sell_price: formData.sell_price ? parseFloat(formData.sell_price) : null,
                cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
                stock_quantity: parseInt(formData.stock_quantity) || 0,
                unit: formData.unit || null,
                image: imageUrl,
            }

            let error = null

            if (product) {
                const { error: updateError } = await supabase
                    .from('products')
                    .update(productData)
                    .eq('product_id', product.product_id)
                error = updateError
            } else {
                const { error: insertError } = await supabase
                    .from('products')
                    .insert([productData])
                error = insertError
            }

            if (!error) {
                onSuccess()
            } else {
                setError(t('error') + ': ' + error.message)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
        >
            <div
                className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* رأس المودال */}
                <div className="flex justify-between items-center p-6 border-b border-silver/20">
                    <h2 className="text-xl font-alata text-gold">
                        {product ? t('editProduct') : t('addNew')}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-silver/20 rounded-lg transition">
                        <span className="material-icons text-silver">close</span>
                    </button>
                </div>

                {/* جسم المودال */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* حقل الصورة */}
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gold/50 flex-shrink-0 bg-[#0a0a0c]">
                            <Image
                                src={imagePreview || '/assets/images/product.svg'}
                                alt="Product"
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-silver text-sm mb-1">
                                {t('productImage')}
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="w-full text-sm text-silver file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-gold file:text-darkwhite hover:file:bg-yellow-600"
                            />
                            {uploading && <p className="text-gold text-xs mt-1">{t('uploading')}</p>}
                        </div>
                    </div>

                    {/* شبكة الحقول */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-silver mb-2">{t('productCode')}</label>
                            <input
                                value={formData.product_id}
                                readOnly
                                required
                                className="w-full px-4 py-2 bg-[#0a0a0c] border border-silver/20 rounded-lg text-silver cursor-not-allowed opacity-80 focus:outline-none"
                            />
                            <p className="text-xs text-silver mt-1">
                                {product ? t('codeCannotBeEdited') : t('codeAutoGenerated')}
                            </p>
                        </div>

                        <div>
                            <label className="block text-silver mb-2">{t('productName')}</label>
                            <div className="relative">
                                <input
                                    value={formData.name}
                                    onChange={(e) => {
                                        setFormData({ ...formData, name: e.target.value })
                                        if (e.target.value.length >= 2) {
                                            checkDuplicateProduct(e.target.value)
                                        } else {
                                            setProductSuggestions([])
                                        }
                                    }}
                                    onBlur={() => setTimeout(() => setProductSuggestions([]), 200)}
                                    required
                                    className="w-full px-4 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver placeholder-silver/50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
                                    placeholder={t('enterProductName')}
                                />
                                {productSuggestions.length > 0 && !product && (
                                    <div className="absolute z-50 w-full mt-1 bg-[#1a1a1e]/95 backdrop-blur-md border border-gold/30 rounded-xl shadow-2xl overflow-hidden">
                                        {productSuggestions.map(p => (
                                            <div
                                                key={p.product_id}
                                                className="px-4 py-2.5 border-b border-silver/10 last:border-0 hover:bg-gold/40 cursor-pointer text-silver hover:text-silver transition-colors"
                                            >
                                                <span>{p.name}</span>
                                                <span className="text-gold text-xs mr-2">({p.product_id})</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-silver mb-2">{t('category')}</label>
                            <div className="relative">
                                <input
                                    value={formData.category}
                                    onChange={(e) => {
                                        setFormData({ ...formData, category: e.target.value })
                                        if (e.target.value.length >= 1) {
                                            searchCategories(e.target.value)
                                        } else {
                                            setCategorySuggestions([])
                                        }
                                    }}
                                    onBlur={() => setTimeout(() => setCategorySuggestions([]), 200)}
                                    className="w-full px-4 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver placeholder-silver/50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
                                    placeholder={t('searchForCategory')}
                                />
                                {categorySuggestions.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-[#1a1a1e]/95 backdrop-blur-md border border-gold/30 rounded-xl shadow-2xl overflow-hidden">
                                        {categorySuggestions.map(cat => (
                                            <div
                                                key={cat}
                                                onMouseDown={() => {
                                                    setFormData({ ...formData, category: cat })
                                                    setCategorySuggestions([])
                                                }}
                                                className="px-4 py-2.5 hover:bg-gold/40 cursor-pointer transition-all border-b border-silver/10 last:border-0 text-silver hover:text-silver"
                                            >
                                                {cat}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-silver mb-2">{t('unit')}</label>
                            <input
                                value={formData.unit}
                                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                className="w-full px-4 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver placeholder-silver/50 focus:outline-none focus:border-gold transition-all"
                                placeholder={t('unitExample')}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-silver mb-2">{t('sellPrice')}</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.sell_price}
                                onChange={(e) => setFormData({ ...formData, sell_price: e.target.value })}
                                className="w-full px-4 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver placeholder-silver/50 focus:outline-none focus:border-gold transition-all"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-silver mb-2">{t('costPrice')}</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.cost_price}
                                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                                className="w-full px-4 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver placeholder-silver/50 focus:outline-none focus:border-gold transition-all"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-silver mb-2">{t('quantity')}</label>
                        <input
                            type="number"
                            value={formData.stock_quantity}
                            onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                            className="w-full px-4 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver placeholder-silver/50 focus:outline-none focus:border-gold transition-all"
                        />
                    </div>

                    {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

                    {/* أزرار التحكم */}
                    <div className="flex gap-3 pt-4 border-t border-silver/20">
                        <button type="submit" disabled={loading || uploading} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold hover:bg-yellow-600 transition disabled:opacity-50">
                            {loading ? t('loading') : t('save')}
                        </button>
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-silver/10 rounded-lg text-silver hover:bg-silver/20 transition">
                            {t('cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}