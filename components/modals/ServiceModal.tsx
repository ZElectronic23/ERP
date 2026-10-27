'use client';

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface ServiceModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    service?: any
    language?: 'ar' | 'en'
}

export default function ServiceModal({ isOpen, onClose, onSuccess, service, language = 'ar' }: ServiceModalProps) {
    const isAr = language === 'ar'
    const L = (ar: string, en: string) => (isAr ? ar : en)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [categorySuggestions, setCategorySuggestions] = useState<string[]>([])
    const [nameSuggestions, setNameSuggestions] = useState<any[]>([])
    const [formData, setFormData] = useState({
        service_id: '',
        name: '',
        category: '',
        unit: '',
        sell_price: '',
        cost_price: '',
        estimated_hours: '',
        assigned_department: '',
        notes: '',
    })

    // ملء البيانات عند التعديل، أو تفريغها عند الإضافة
    useEffect(() => {
        if (service) {
            setFormData({
                service_id: service.service_id || '',
                name: service.name || '',
                category: service.category || '',
                unit: service.unit || '',
                sell_price: service.sell_price ?? '',
                cost_price: service.cost_price ?? '',
                estimated_hours: service.estimated_hours ?? '',
                assigned_department: service.assigned_department || '',
                notes: service.notes || '',
            })
        } else {
            setFormData({
                service_id: '', name: '', category: '', unit: '',
                sell_price: '', cost_price: '', estimated_hours: '', assigned_department: '', notes: '',
            })
        }
        setError('')
    }, [service, isOpen])

    const searchCategories = async (input: string) => {
        if (input.length < 1) { setCategorySuggestions([]); return }
        const { data } = await supabase
            .from('services')
            .select('category')
            .ilike('category', `%${input}%`)
            .not('category', 'is', null)
            .limit(20)
        const unique = [...new Set((data || []).map(d => d.category))].filter(Boolean) as string[]
        setCategorySuggestions(unique.slice(0, 5))
    }

    const checkDuplicateName = async (name: string) => {
        if (name.length < 2) { setNameSuggestions([]); return }
        const { data } = await supabase
            .from('services')
            .select('service_id, name')
            .is('deleted_at', null)
            .ilike('name', `%${name}%`)
            .limit(3)
        setNameSuggestions(data || [])
    }

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            const payload: any = {
                service_id: formData.service_id.trim(),
                name: formData.name.trim(),
                category: formData.category || null,
                unit: formData.unit || null,
                sell_price: formData.sell_price !== '' ? parseFloat(String(formData.sell_price)) : null,
                cost_price: formData.cost_price !== '' ? parseFloat(String(formData.cost_price)) : null,
                estimated_hours: formData.estimated_hours !== '' ? parseFloat(String(formData.estimated_hours)) : null,
                assigned_department: formData.assigned_department || null,
                notes: formData.notes || null,
            }

            let err = null
            if (service) {
                const { error: updateError } = await supabase
                    .from('services')
                    .update(payload)
                    .eq('service_id', service.service_id)
                err = updateError
            } else {
                const { error: insertError } = await supabase
                    .from('services')
                    .insert([payload])
                err = insertError
            }

            if (!err) {
                onSuccess()
            } else {
                setError((isAr ? 'خطأ: ' : 'Error: ') + err.message)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const field = 'w-full px-4 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver placeholder-silver/50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all'

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
            dir={isAr ? 'rtl' : 'ltr'}
        >
            <div
                className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-6 border-b border-silver/20">
                    <h2 className="text-xl font-alata text-gold">
                        {service ? L('تعديل خدمة', 'Edit Service') : L('إضافة خدمة', 'Add Service')}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-silver/20 rounded-lg transition text-silver">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-silver mb-2">{L('الكود', 'Code')}</label>
                            <input
                                value={formData.service_id}
                                onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                                readOnly={!!service}
                                required
                                placeholder={L('مثال: S-CCTV-001', 'e.g. S-CCTV-001')}
                                className={`${field} ${service ? 'cursor-not-allowed opacity-80' : ''}`}
                            />
                            <p className="text-xs text-silver/70 mt-1">
                                {service ? L('لا يمكن تعديل الكود', 'Code cannot be edited') : L('أدخل كود الخدمة', 'Enter the service code')}
                            </p>
                        </div>

                        <div>
                            <label className="block text-silver mb-2">{L('الاسم', 'Name')}</label>
                            <div className="relative">
                                <input
                                    value={formData.name}
                                    onChange={(e) => {
                                        setFormData({ ...formData, name: e.target.value })
                                        if (!service) checkDuplicateName(e.target.value)
                                    }}
                                    onBlur={() => setTimeout(() => setNameSuggestions([]), 200)}
                                    required
                                    className={field}
                                    placeholder={L('اسم الخدمة', 'Service name')}
                                />
                                {nameSuggestions.length > 0 && !service && (
                                    <div className="absolute z-50 w-full mt-1 bg-[#1a1a1e]/95 backdrop-blur-md border border-gold/30 rounded-xl shadow-2xl overflow-hidden">
                                        {nameSuggestions.map(s => (
                                            <div key={s.service_id} className="px-4 py-2.5 border-b border-silver/10 last:border-0 text-silver">
                                                <span>{s.name}</span>
                                                <span className="text-gold text-xs mx-2">({s.service_id})</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-silver mb-2">{L('الفئة', 'Category')}</label>
                            <div className="relative">
                                <input
                                    value={formData.category}
                                    onChange={(e) => {
                                        setFormData({ ...formData, category: e.target.value })
                                        searchCategories(e.target.value)
                                    }}
                                    onBlur={() => setTimeout(() => setCategorySuggestions([]), 200)}
                                    className={field}
                                    placeholder={L('ابحث عن فئة', 'Search category')}
                                />
                                {categorySuggestions.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-[#1a1a1e]/95 backdrop-blur-md border border-gold/30 rounded-xl shadow-2xl overflow-hidden">
                                        {categorySuggestions.map(cat => (
                                            <div
                                                key={cat}
                                                onMouseDown={() => { setFormData({ ...formData, category: cat }); setCategorySuggestions([]) }}
                                                className="px-4 py-2.5 hover:bg-gold/40 cursor-pointer border-b border-silver/10 last:border-0 text-silver"
                                            >
                                                {cat}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-silver mb-2">{L('الوحدة', 'Unit')}</label>
                            <input
                                value={formData.unit}
                                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                className={field}
                                placeholder={L('مثال: لكل نقطة', 'e.g. per point')}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-silver mb-2">{L('سعر البيع', 'Sell Price')}</label>
                            <input type="number" step="0.01" value={formData.sell_price}
                                onChange={(e) => setFormData({ ...formData, sell_price: e.target.value })}
                                className={field} placeholder="0.00" />
                        </div>
                        <div>
                            <label className="block text-silver mb-2">{L('التكلفة', 'Cost')}</label>
                            <input type="number" step="0.01" value={formData.cost_price}
                                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                                className={field} placeholder="0.00" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-silver mb-2">{L('ساعات مقدرة', 'Est. Hours')}</label>
                            <input type="number" step="0.5" value={formData.estimated_hours}
                                onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                                className={field} placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-silver mb-2">{L('القسم', 'Department')}</label>
                            <input value={formData.assigned_department}
                                onChange={(e) => setFormData({ ...formData, assigned_department: e.target.value })}
                                className={field} placeholder={L('القسم المسؤول', 'Responsible dept.')} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-silver mb-2">{L('ملاحظات', 'Notes')}</label>
                        <textarea value={formData.notes} rows={2}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className={field} placeholder={L('ملاحظات إضافية', 'Additional notes')} />
                    </div>

                    {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

                    <div className="flex gap-3 pt-4 border-t border-silver/20">
                        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold hover:bg-yellow-600 transition disabled:opacity-50">
                            {loading ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ', 'Save')}
                        </button>
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-silver/10 rounded-lg text-silver hover:bg-silver/20 transition">
                            {L('إلغاء', 'Cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
