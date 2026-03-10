'use client';

import { useTableData } from '@/hooks/useTableData'
import { useDelete } from '@/hooks/useDelete'
import DataTable from '@/components/data/DataTable'
import ProductModal from '@/components/modals/ProductModal'
import { tableConfigs } from '@/config/tables'
import type { Column } from '@/config/tables'
import { useState, useEffect, useRef, useCallback } from 'react'
import { translations, Language } from '@/lib/translations'
import { supabase } from '@/lib/supabaseClient'
import Image from 'next/image'
import WeatherPopup from '@/components/WeatherPopup'
import { fetchWeatherData } from '@/lib/weather'
import UserMenu from '@/components/UserMenu'
import CategoryDropdown from '@/components/CategoryDropdown'

export default function ProductsPage() {

    // ===== Refs =====
    const tableContainerRef = useRef<HTMLDivElement>(null)
    const tableHeaderRef = useRef<HTMLTableSectionElement>(null)
    const floatingScrollRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)

    // ===== State =====
    const [filters, setFilters] = useState({
        search: '', searchBy: 'name', category: '', minPrice: '', maxPrice: '', lowStock: ''
    })
    const [showLeftScroll, setShowLeftScroll] = useState(false)
    const [showRightScroll, setShowRightScroll] = useState(false)
    const [showFloatingHeader, setShowFloatingHeader] = useState(false)
    const [isClient, setIsClient] = useState(false)
    const [imagesLoaded, setImagesLoaded] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<any>(null)
    const [isDateExpanded, setIsDateExpanded] = useState(false)
    const [isWeatherOpen, setIsWeatherOpen] = useState(false)
    const [weatherData, setWeatherData] = useState<any>(null)
    const [weatherLoading, setWeatherLoading] = useState(false)
    const [searchSuggestions, setSearchSuggestions] = useState<any[]>([])
    const [showAutocomplete, setShowAutocomplete] = useState(false)
    const autocompleteRef = useRef<HTMLDivElement>(null)
    const [language, setLanguage] = useState<Language>('ar')
    const t = translations[language]

    // ===== Data =====
    const { data, loading, error, refresh } = useTableData('products', {
        search: filters.searchBy === 'code' ? '' : filters.search,
        code: filters.searchBy === 'code' ? filters.search : '',
        filters: { category: filters.category },
        priceRange: { min: filters.minPrice, max: filters.maxPrice },
        lowStock: filters.lowStock ? parseInt(filters.lowStock) : null,
        orderBy: 'product_id',
        orderDirection: 'asc'
    })
    const { softDelete } = useDelete('products', () => refresh())
    const config = tableConfigs.products
    const uniqueCategories = Array.from(new Set(
        data.map((p: any) => p.category).filter((c: any): c is string => Boolean(c))
    ))

    // ===== Time =====
    const now = new Date()
    const timeString = now.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })
    const dayName = now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' }).slice(0, 3)
    const day = now.getDate().toString().padStart(2, '0')
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const year = now.getFullYear().toString().slice(-2)
    const shortDate = `${dayName} ${day}/${month}/${year}`
    const fullDate = now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    // ===== Init =====
    useEffect(() => {
        setIsClient(true)
        const urls = [
            '/assets/images/cloud.svg', '/assets/images/left.svg', '/assets/images/right.svg',
            '/assets/images/search.ico', '/assets/images/add.png', '/assets/images/ERP.svg',
            '/assets/images/BG.png', '/assets/images/product.svg'
        ]
        let n = 0
        urls.forEach(url => {
            const img = new window.Image(); img.src = url
            img.onload = img.onerror = () => { if (++n === urls.length) setImagesLoaded(true) }
        })
    }, [])

    useEffect(() => {
        try {
            const saved = localStorage.getItem('preferred-language') as Language || 'ar'
            setLanguage(saved)
            document.documentElement.lang = saved
            document.documentElement.dir = saved === 'ar' ? 'rtl' : 'ltr'
        } catch (_) { }
    }, [])

    // ===== Floating Header Scroll Sync =====
    useEffect(() => {
        const container = tableContainerRef.current
        const floatingHeader = floatingScrollRef.current
        if (!container) return

        const onScroll = () => {
            const { scrollLeft, scrollTop, scrollWidth, clientWidth } = container
            setShowLeftScroll(scrollLeft > 10)
            setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 10)
            setShowFloatingHeader(scrollTop > 10)

            // ✅ مزامنة أفقية مباشرة — DOM mutation بدون re-render
            if (floatingHeader) {
                floatingHeader.scrollLeft = scrollLeft
            }
        }

        // ✅ مزامنة عكسية: لما المستخدم يعمل scroll على الهيدر العائم
        const onFloatingScroll = () => {
            if (!floatingHeader || !container) return
            container.scrollLeft = floatingHeader.scrollLeft
        }

        container.addEventListener('scroll', onScroll, { passive: true })
        if (floatingHeader) {
            floatingHeader.addEventListener('scroll', onFloatingScroll, { passive: true })
        }

        onScroll()

        return () => {
            container.removeEventListener('scroll', onScroll)
            if (floatingHeader) {
                floatingHeader.removeEventListener('scroll', onFloatingScroll)
            }
        }
    }, [data])

    // ✅ مزامنة عروض الأعمدة من thead الأصلي للهيدر العائم
    const syncColumnWidths = useCallback(() => {
        const origThs = tableHeaderRef.current?.querySelectorAll('th')
        const floatThs = floatingScrollRef.current?.querySelectorAll('th')
        if (!origThs?.length || !floatThs?.length) return
        origThs.forEach((th, i) => {
            const fth = floatThs[i] as HTMLElement | undefined
            if (!fth) return
            const w = (th as HTMLElement).offsetWidth
            fth.style.width = `${w}px`
            fth.style.minWidth = `${w}px`
            fth.style.maxWidth = `${w}px`
        })
    }, [])

    useEffect(() => {
        if (loading) return
        const t1 = setTimeout(syncColumnWidths, 150)
        const t2 = setTimeout(syncColumnWidths, 500)
        return () => { clearTimeout(t1); clearTimeout(t2) }
    }, [data, loading, language, syncColumnWidths])

    useEffect(() => {
        if (showFloatingHeader) setTimeout(syncColumnWidths, 50)
    }, [showFloatingHeader, syncColumnWidths])

    // ===== Autocomplete — إغلاق بالضغط بعيداً =====
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node
            if (
                !autocompleteRef.current?.contains(target) &&
                !searchInputRef.current?.contains(target)
            ) setShowAutocomplete(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // ===== Weather =====
    const openWeatherPopup = async () => {
        setIsWeatherOpen(true); setWeatherLoading(true)
        try { setWeatherData(await fetchWeatherData(language)) }
        catch (e) { console.error(e) }
        finally { setWeatherLoading(false) }
    }

    // ===== Autocomplete Search =====
    const searchProducts = async (val: string) => {
        if (val.length < 2) { setSearchSuggestions([]); setShowAutocomplete(false); return }
        const { data: r } = await supabase.from('products')
            .select('product_id, name')
            .ilike('name', `%${val}%`)
            .limit(6)
        if (r?.length) { setSearchSuggestions(r); setShowAutocomplete(true) }
        else { setSearchSuggestions([]); setShowAutocomplete(false) }
    }

    const handleSuggestionClick = (item: any) => {
        const name = item.name as string
        if (searchInputRef.current) searchInputRef.current.value = name
        setShowAutocomplete(false)
        setSearchSuggestions([])
        setFilters(f => ({ ...f, search: name, searchBy: 'name' }))
    }

    // ===== Apply Filters =====
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        setFilters({
            search: (fd.get('search') as string) || '',
            searchBy: (fd.get('searchBy') as string) || 'name',
            category: (fd.get('category') as string) || '',
            minPrice: (fd.get('minPrice') as string) || '',
            maxPrice: (fd.get('maxPrice') as string) || '',
            lowStock: (fd.get('lowStock') as string) || '',
        })
        setShowAutocomplete(false)
    }

    const handleReset = () => {
        setFilters({ search: '', searchBy: 'name', category: '', minPrice: '', maxPrice: '', lowStock: '' })
        setSearchSuggestions([])
        setShowAutocomplete(false)
        if (searchInputRef.current) searchInputRef.current.value = ''
    }

    const toggleLanguage = () => {
        const nl = language === 'ar' ? 'en' : 'ar'
        setLanguage(nl)
        document.documentElement.lang = nl
        document.documentElement.dir = nl === 'ar' ? 'rtl' : 'ltr'
        try { localStorage.setItem('preferred-language', nl) } catch (_) { }
    }

    const handleEdit = (p: any) => { setEditingProduct(p); setIsModalOpen(true) }
    const handleAdd = () => { setEditingProduct(null); setIsModalOpen(true) }
    const handleClose = () => { setIsModalOpen(false); setEditingProduct(null) }
    const handleSuccess = () => { refresh(); handleClose() }

    const doScrollLeft = () => tableContainerRef.current?.scrollBy({ left: -300, behavior: 'smooth' })
    const doScrollRight = () => tableContainerRef.current?.scrollBy({ left: 300, behavior: 'smooth' })

    // ===== Columns =====
    const imageColumn: Column = {
        key: 'image',
        label: language === 'ar' ? 'صورة' : 'Image',
        type: 'image',
        render: (_: any, row: any) => (
            <div className="flex justify-center">
                {row.image
                    ? <Image src={row.image} alt={row.name} width={30} height={30} className="rounded object-cover" />
                    : <Image src="/assets/images/product.svg" alt="product" width={30} height={30} className="rounded object-cover opacity-70" />
                }
            </div>
        ),
        className: 'text-center'
    }

    const columns: Column[] = [
        imageColumn,
        ...config.columns.map((col: any) => ({
            ...col, type: col.type || 'text', className: 'text-[12px] px-1 py-1'
        }))
    ]

    const colLabels = columns.map(col => {
        const map: Record<string, Record<Language, string>> = {
            image: { ar: 'صورة', en: 'Image' },
            product_id: { ar: t.productCode, en: t.productCode },
            name: { ar: t.productName, en: t.productName },
            category: { ar: t.category, en: t.category },
            sell_price: { ar: t.sellPrice, en: t.sellPrice },
            cost_price: { ar: t.costPrice, en: t.costPrice },
            stock_quantity: { ar: t.quantity, en: t.quantity },
            unit: { ar: t.unit, en: t.unit },
        }
        return map[col.key]?.[language] ?? col.label ?? col.key
    })

    // ===== Loading screen =====
    if (!isClient || !imagesLoaded) return (
        <div className="min-h-screen flex items-center justify-center"
            style={{ backgroundImage: "url('/assets/images/BG.png')", backgroundSize: 'cover', backgroundAttachment: 'fixed' }}>
            <div className="bg-darkwhite/70 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-gold/30 flex flex-col items-center gap-4">
                <div className="w-20 h-20 relative">
                    <Image src="/assets/images/ERP.svg" alt="ERP" fill className="object-contain animate-pulse" priority />
                </div>
                <div className="text-gold font-alata text-xl animate-pulse">جاري التحميل...</div>
            </div>
        </div>
    )

    if (error) return (
        <div className="min-h-screen p-4 flex items-center justify-center"
            style={{ backgroundImage: "url('/assets/images/BG.png')", backgroundSize: 'cover' }}
            dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="bg-[#1a1a1e]/90 rounded-2xl p-6 text-white border border-silver/30">
                <p className="text-gold">{t.error}: {error.message}</p>
            </div>
        </div>
    )

    const selectArrow = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20' stroke='%23DBA935'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`
    const selectStyle = { backgroundImage: selectArrow, backgroundPosition: 'left 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '0.7rem', paddingLeft: '1.5rem' }

    return (
        <div
            className="min-h-screen p-4 md:p-6"
            style={{ backgroundImage: "url('/assets/images/BG.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
            <div className="min-h-screen bg-darkwhite/70 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-white/10">

                {/* ==================== HEADER ==================== */}
                <div className="relative w-full mb-2" style={{ minHeight: '70px' }} dir="ltr">

                    {/* الوقت — يسار */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2">
                        <div
                            className="flex items-center gap-1 text-silver cursor-pointer hover:border hover:border-gold/50 rounded-full px-2 py-1 transition-all"
                            onMouseEnter={() => setIsDateExpanded(true)}
                            onMouseLeave={() => setIsDateExpanded(false)}
                        >
                            <span suppressHydrationWarning className="text-sm">{timeString}</span>
                            {isDateExpanded && (
                                <>
                                    <span className="text-xs text-silver/80">{shortDate}</span>
                                    <button onClick={openWeatherPopup} className="text-gold hover:text-yellow-500 transition-colors" title={fullDate}>
                                        <Image src="/assets/images/cloud.svg" alt="الطقس" width={20} height={20} className="w-5 h-5 object-contain" priority />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* اللوجو — وسط */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <Image src="/assets/images/ERP.svg" alt="ERP" width={140} height={140} className="w-28 h-28 md:w-32 md:h-32 object-contain" priority />
                    </div>

                    {/* يمين: زر اللغة + UserMenu */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2" style={{ zIndex: 99999 }}>
                        <button
                            onClick={toggleLanguage}
                            className="px-3 py-1 rounded-full border border-gold/30 text-gold hover:bg-gold/40 hover:text-darkwhite transition-colors text-sm font-medium"
                        >
                            {language === 'ar' ? 'EN' : 'AR'}
                        </button>
                        <UserMenu language={language} onLanguageToggle={toggleLanguage} />
                    </div>
                </div>

                {/* العنوان */}
                <div className="mb-3">
                    <h1 className="text-lg font-alata text-gold drop-shadow-lg">{t.products}</h1>
                </div>

                {/* ==================== SEARCH BAR ==================== */}
                <form onSubmit={handleSubmit} className="mb-6 w-full" style={{ position: 'relative', zIndex: 50 }}>
                    <div className="bg-[#1a1a1e]/90 backdrop-blur-xl rounded-xl border border-gold/30 p-2 shadow-xl">
                        <div className="flex flex-wrap items-center gap-1">

                            {/* ===== Input + Autocomplete ===== */}
                            <div className="flex-1 min-w-[150px] relative">
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    name="search"
                                    autoComplete="off"
                                    onChange={e => searchProducts(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Escape') setShowAutocomplete(false)
                                        if (e.key === 'Enter') setShowAutocomplete(false)
                                    }}
                                    className="w-full px-3 py-1.5 bg-[#0a0a0c] border border-silver/30 rounded-full text-white text-xs focus:outline-none focus:border-gold transition-all"
                                />

                                {/* Autocomplete dropdown */}
                                {showAutocomplete && searchSuggestions.length > 0 && (
                                    <div
                                        ref={autocompleteRef}
                                        className="absolute top-full mt-1 w-full bg-[#1a1a1e] border border-gold/30 rounded-xl shadow-2xl overflow-hidden"
                                        style={{ zIndex: 9999 }}
                                        dir={language === 'ar' ? 'rtl' : 'ltr'}
                                    >
                                        {searchSuggestions.map((item: any) => (
                                            <div
                                                key={item.product_id}
                                                onMouseDown={(e) => {
                                                    e.preventDefault()
                                                    handleSuggestionClick(item)
                                                }}
                                                className="px-3 py-2 flex items-center justify-between border-b border-silver/10 last:border-0 hover:bg-gold/20 cursor-pointer transition-colors"
                                            >
                                                <span className="text-white text-xs">{item.name}</span>
                                                <span className="text-gold text-[10px] opacity-60">#{item.product_id}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* searchBy */}
                            <select name="searchBy" defaultValue="name"
                                className="px-2 py-1.5 bg-[#0a0a0c] border border-silver/30 rounded-full text-white hover:border-gold focus:outline-none text-[11px] appearance-none cursor-pointer"
                                style={{ minWidth: '65px', ...selectStyle }}>
                                <option value="name" className="bg-[#0a0a0c]">Name</option>
                                <option value="code" className="bg-[#0a0a0c]">Code</option>
                            </select>

                            {/* ✅ Category Dropdown - بنفس ستايل UserMenu */}
                            <CategoryDropdown
                                categories={uniqueCategories}
                                selectedCategory={filters.category}
                                onSelectCategory={(cat) => setFilters(f => ({ ...f, category: cat }))}
                                language={language}
                            />

                            {/* lowStock */}
                            <select name="lowStock" defaultValue=""
                                className="px-2 py-1.5 bg-[#0a0a0c] border border-silver/30 rounded-full text-white hover:border-gold focus:outline-none text-[11px] appearance-none cursor-pointer"
                                style={{ minWidth: '60px', ...selectStyle }}>
                                <option value="" className="bg-[#0a0a0c]">Qty</option>
                                {['5', '10', '20', '50'].map(v => (
                                    <option key={v} value={v} className="bg-[#0a0a0c]">{v}</option>
                                ))}
                            </select>

                            {/* price range */}
                            <div className="flex items-center gap-0.5 bg-[#0a0a0c] border border-silver/30 rounded-full px-1.5 py-1">
                                <span className="text-silver text-[9px]">$</span>
                                <input type="number" name="minPrice" placeholder="0" className="w-9 bg-transparent text-white text-[9px] focus:outline-none" />
                                <span className="text-silver text-[9px]">-</span>
                                <input type="number" name="maxPrice" placeholder="0" className="w-9 bg-transparent text-white text-[9px] focus:outline-none" />
                            </div>

                            {/* Search */}
                            <button type="submit" title={t.search}
                                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gold/20 transition-colors flex-shrink-0">
                                <Image src="/assets/images/search.ico" alt="بحث" width={20} height={20} className="w-5 h-5 object-contain" />
                            </button>

                            {/* Reset */}
                            <button type="button" onClick={handleReset} title="Reset"
                                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500/20 transition-colors flex-shrink-0 text-silver hover:text-red-400">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                            </button>

                            {/* Add */}
                            <button type="button" onClick={handleAdd} title={t.add}
                                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gold/20 transition-colors flex-shrink-0">
                                <Image src="/assets/images/add.png" alt="إضافة" width={20} height={20} className="w-5 h-5 object-contain" />
                            </button>
                        </div>
                    </div>
                </form>

                {/* ==================== TABLE ==================== */}
                <div className="relative w-full">

                    {/* ==================== FLOATING HEADER ==================== */}
                    {showFloatingHeader && (
                        <div
                            ref={floatingScrollRef}
                            className="absolute top-0 left-0 right-0 overflow-x-auto scrollbar-none"
                            style={{ zIndex: 10 }}
                            dir={language === 'ar' ? 'rtl' : 'ltr'}
                        >
                            <table style={{ tableLayout: 'fixed', width: '100%', minWidth: '800px' }}>
                                <thead className="bg-gradient-to-b from-[#2a2a2e] to-[#1a1a1e] border-b-2 border-gold/30 shadow-lg">
                                    <tr>
                                        {colLabels.map((label, i) => (
                                            <th
                                                key={i}
                                                className="p-4 font-alata font-bold text-gold text-sm tracking-wide whitespace-nowrap overflow-hidden"
                                                style={{ textAlign: language === 'ar' ? 'right' : 'left' }}
                                            >
                                                {label}
                                            </th>
                                        ))}
                                        <th className="p-4 text-center font-alata font-bold text-gold text-sm tracking-wide whitespace-nowrap">
                                            {t.edit}
                                        </th>
                                    </tr>
                                </thead>
                            </table>
                        </div>
                    )}

                    {/* ===== الجدول الأصلي ===== */}
                    <div
                        ref={tableContainerRef}
                        className="overflow-auto max-h-[350px] scrollbar-thin scrollbar-thumb-gold/50 scrollbar-track-transparent"
                    >
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gold" />
                                <p className="text-silver text-xs mt-2">{t.loading}</p>
                            </div>
                        ) : (
                            <DataTable
                                tableName="products"
                                columns={columns}
                                data={data}
                                onEdit={handleEdit}
                                onDelete={(id: string) => softDelete(id, 'product_id')}
                                idColumn="product_id"
                                language={language}
                                tableHeaderRef={tableHeaderRef}
                            />
                        )}
                    </div>

                    {/* أزرار التمرير */}
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 pointer-events-none flex justify-between px-1" style={{ zIndex: 5 }}>
                        {showLeftScroll && (
                            <button onClick={doScrollLeft} className="pointer-events-auto w-7 h-7 flex items-center justify-center bg-gold/20 hover:bg-gold/40 rounded-full">
                                <Image src="/assets/images/left.svg" alt="يسار" width={28} height={28} className="w-6 h-6 object-contain" />
                            </button>
                        )}
                        {showRightScroll && (
                            <button onClick={doScrollRight} className="pointer-events-auto w-7 h-7 flex items-center justify-center bg-gold/20 hover:bg-gold/40 rounded-full">
                                <Image src="/assets/images/right.svg" alt="يمين" width={28} height={28} className="w-6 h-6 object-contain" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <ProductModal
                isOpen={isModalOpen} onClose={handleClose} onSuccess={handleSuccess}
                product={editingProduct} language={language}
            />
            <WeatherPopup
                isOpen={isWeatherOpen} onClose={() => setIsWeatherOpen(false)}
                weatherData={weatherData} loading={weatherLoading} language={language}
            />
        </div>
    )
}