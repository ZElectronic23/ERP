'use client';

import { useTableData } from '@/hooks/useTableData'
import { useDelete } from '@/hooks/useDelete'
import DataTable from '@/components/data/DataTable'
import ProductModal from '@/components/modals/ProductModal'
import { tableConfigs } from '@/config/tables'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { translations, Language } from '@/lib/translations'
import { supabase } from '@/lib/supabaseClient'
import Image from 'next/image'
import WeatherPopup from '@/components/WeatherPopup'
import { fetchWeatherData } from '@/lib/weather'

export default function ProductsPage() {
    // ==================== CLIENT SIDE CHECK ====================
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
    }, [])

    // إذا كان لسه في مرحلة بناء السيرفر، اعرض صفحة فارغة أو loading
    if (!isClient) {
        return (
            <div className="min-h-screen bg-darkwhite flex items-center justify-center">
                <div className="text-gold">جاري التحميل...</div>
            </div>
        )
    }

    // ==================== HOOKS ====================
    const router = useRouter()
    const searchParams = useSearchParams()
    const tableContainerRef = useRef<HTMLDivElement>(null)
    const tableHeaderRef = useRef<HTMLDivElement>(null)
    const floatingTableHeaderRef = useRef<HTMLDivElement>(null)

    // ==================== STATES ====================
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<any>(null)
    const [isDateExpanded, setIsDateExpanded] = useState(false)

    // Table scroll states
    const [showLeftScroll, setShowLeftScroll] = useState(false)
    const [showRightScroll, setShowRightScroll] = useState(false)
    const [tableScrollLeft, setTableScrollLeft] = useState(0)

    // Weather states
    const [isWeatherOpen, setIsWeatherOpen] = useState(false)
    const [weatherData, setWeatherData] = useState<any>(null)
    const [weatherLoading, setWeatherLoading] = useState(false)

    // Autocomplete state
    const [searchSuggestions, setSearchSuggestions] = useState<any[]>([])

    // ==================== URL PARAMS ====================
    const search = searchParams.get('search') || ''
    const searchBy = searchParams.get('searchBy') || 'name'
    const category = searchParams.get('category') || ''
    const minPrice = searchParams.get('minPrice') || ''
    const maxPrice = searchParams.get('maxPrice') || ''
    const lowStock = searchParams.get('lowStock') || ''

    // ==================== DATA FETCHING ====================
    const { data, loading, error, refresh } = useTableData('products', {
        search: searchBy === 'code' ? '' : search,
        code: searchBy === 'code' ? search : '',
        filters: { category },
        priceRange: { min: minPrice, max: maxPrice },
        lowStock: lowStock ? parseInt(lowStock) : null,
        orderBy: 'product_id',
        orderDirection: 'asc'
    })

    const { softDelete } = useDelete('products', () => {
        refresh()
    })

    const config = tableConfigs.products

    const uniqueCategories = Array.from(new Set(
        data
            .map(p => p.category)
            .filter((cat): cat is string => Boolean(cat) && typeof cat === 'string')
    ))

    // ==================== LANGUAGE ====================
    const [language, setLanguage] = useState<Language>('ar')
    const t = translations[language]

    useEffect(() => {
        const savedLang = localStorage.getItem('preferred-language') as Language || 'ar'
        setLanguage(savedLang)
        document.documentElement.lang = savedLang
        document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr'
    }, [])

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

    // ==================== TABLE SCROLL ====================
    useEffect(() => {
        const handleTableScroll = () => {
            if (tableContainerRef.current) {
                setTableScrollLeft(tableContainerRef.current.scrollLeft)

                const { scrollLeft, scrollWidth, clientWidth } = tableContainerRef.current
                setShowLeftScroll(scrollLeft > 10)
                setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 10)
            }
        }

        const container = tableContainerRef.current
        if (container) {
            container.addEventListener('scroll', handleTableScroll)
            handleTableScroll()
            return () => container.removeEventListener('scroll', handleTableScroll)
        }
    }, [data])

    // Update floating header position
    useEffect(() => {
        if (floatingTableHeaderRef.current) {
            floatingTableHeaderRef.current.style.transform = `translateX(-${tableScrollLeft}px)`
        }
    }, [tableScrollLeft])

    // ==================== SEARCH ====================
    const searchProducts = async (input: string) => {
        if (input.length < 2) {
            setSearchSuggestions([])
            return
        }

        const { data } = await supabase
            .from('products')
            .select('product_id, name')
            .ilike('name', `%${input}%`)
            .limit(5)

        setSearchSuggestions(data || [])
    }

    const applyFilters = (formData: FormData) => {
        const params = new URLSearchParams()

        const searchTerm = formData.get('search') as string
        const searchByVal = formData.get('searchBy') as string
        const categoryVal = formData.get('category') as string
        const minPriceVal = formData.get('minPrice') as string
        const maxPriceVal = formData.get('maxPrice') as string
        const lowStockVal = formData.get('lowStock') as string

        if (searchTerm) params.set('search', searchTerm)
        if (searchByVal) params.set('searchBy', searchByVal)
        if (categoryVal) params.set('category', categoryVal)
        if (minPriceVal) params.set('minPrice', minPriceVal)
        if (maxPriceVal) params.set('maxPrice', maxPriceVal)
        if (lowStockVal) params.set('lowStock', lowStockVal)

        router.push(`/products?${params.toString()}`)
    }

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        applyFilters(formData)
    }

    // ==================== LANGUAGE TOGGLE ====================
    const toggleLanguage = () => {
        const newLang = language === 'ar' ? 'en' : 'ar'
        setLanguage(newLang)
        document.documentElement.lang = newLang
        document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr'
        localStorage.setItem('preferred-language', newLang)
    }

    // ==================== MODAL HANDLERS ====================
    const handleEdit = (product: any) => {
        setEditingProduct(product)
        setIsModalOpen(true)
    }

    const handleAdd = () => {
        setEditingProduct(null)
        setIsModalOpen(true)
    }

    const handleModalClose = () => {
        setIsModalOpen(false)
        setEditingProduct(null)
    }

    const handleModalSuccess = () => {
        refresh()
        handleModalClose()
    }

    // ==================== SCROLL HANDLERS ====================
    const scrollLeft = () => {
        if (tableContainerRef.current) {
            tableContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' })
        }
    }

    const scrollRight = () => {
        if (tableContainerRef.current) {
            tableContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' })
        }
    }

    // ==================== DATE FORMATTING ====================
    // ✅ تم نقل الـ Date داخل return مع التحقق من isClient
    const now = new Date()
    const timeString = now.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit'
    })

    const dayName = now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' }).slice(0, 3)
    const day = now.getDate().toString().padStart(2, '0')
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const year = now.getFullYear().toString().slice(-2)
    const shortDate = `${dayName} ${day}/${month}/${year}`
    const fullDate = now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })

    // ==================== ERROR STATE ====================
    if (error) {
        return (
            <div
                className="min-h-screen p-4 md:p-6 flex items-center justify-center"
                style={{
                    backgroundImage: "url('/assets/images/BG.png')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundAttachment: 'fixed'
                }}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
            >
                <div className="bg-[#1a1a1e]/90 backdrop-blur-sm rounded-2xl p-6 text-white border border-silver/30 shadow-2xl">
                    <p className="text-gold">{t.error}: {error.message}</p>
                </div>
            </div>
        )
    }

    // ==================== MAIN RENDER ====================
    return (
        <div
            className="min-h-screen p-4 md:p-6"
            style={{
                backgroundImage: "url('/assets/images/BG.png')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed'
            }}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            suppressHydrationWarning
        >
            {/* الطبقة الشفافة فوق الخلفية */}
            <div className="min-h-screen bg-darkwhite/70 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-white/10">

                {/* ==================== HEADER ==================== */}
                <div className="relative w-full mb-4" style={{ minHeight: '100px' }}>
                    {/* الوقت - يسار */}
                    <div className="absolute left-0 top-0">
                        <div
                            className="relative"
                            onMouseEnter={() => setIsDateExpanded(true)}
                            onMouseLeave={() => setIsDateExpanded(false)}
                        >
                            <div className="flex items-center gap-1 text-silver cursor-pointer hover:border hover:border-gold/50 rounded-full px-2 py-1 transition-all">
                                <span suppressHydrationWarning className="text-sm md:text-base">{timeString}</span>
                                {isDateExpanded && (
                                    <>
                                        <span className="text-xs text-silver/80">{shortDate}</span>
                                        <button
                                            onClick={openWeatherPopup}
                                            className="text-gold hover:text-yellow-500 transition-colors"
                                            title={fullDate}
                                        >
                                            <Image
                                                src="/assets/images/cloud.svg"
                                                alt="الطقس"
                                                width={20}
                                                height={20}
                                                className="w-5 h-5 object-contain"
                                            />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* اللوجو - وسط ومرفوع للأعلى */}
                    <div className="absolute left-1/2 top-0 -translate-x-1/2 -mt-8">
                        <div className="flex items-center justify-center">
                            <Image
                                src="/assets/images/ERP.svg"
                                alt="ERP"
                                width={200}
                                height={200}
                                className="w-40 h-40 md:w-44 md:h-44 object-contain"
                            />
                        </div>
                    </div>

                    {/* اللغة - يمين */}
                    <div className="absolute right-0 top-0">
                        <button
                            onClick={toggleLanguage}
                            className="px-3 py-1 rounded-full border border-gold/30 text-gold hover:bg-gold/40 hover:text-darkwhite transition-colors text-sm font-medium"
                        >
                            {language === 'ar' ? 'EN' : 'AR'}
                        </button>
                    </div>
                </div>

                {/* عنوان الصفحة */}
                <div className="mb-2 w-full mt-16">
                    <h1 className="text-lg font-alata text-gold drop-shadow-lg">{t.products}</h1>
                </div>

                {/* ==================== SEARCH SECTION ==================== */}
                <form onSubmit={handleSubmit} className="mb-6 w-full relative z-50">
                    <div className="bg-[#1a1a1e]/90 backdrop-blur-xl rounded-xl border border-gold/30 p-3 shadow-xl">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Search field */}
                            <div className="flex-1 min-w-[200px] relative">
                                <div className="relative">
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-silver">
                                        <span className="material-icons text-sm">search</span>
                                    </span>
                                    <input
                                        type="text"
                                        name="search"
                                        defaultValue={search}
                                        onChange={(e) => searchProducts(e.target.value)}
                                        onBlur={() => setTimeout(() => setSearchSuggestions([]), 200)}
                                        placeholder=""
                                        className="w-full pr-8 pl-2 py-2 bg-[#0a0a0c] border border-silver/30 rounded-full text-white text-xs focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-all hover:bg-[#1a1a1e]"
                                    />
                                </div>

                                {/* Autocomplete */}
                                {searchSuggestions.length > 0 && (
                                    <div className="absolute z-[100] top-full mt-1 w-full bg-[#1a1a1e]/95 backdrop-blur-md border border-gold/30 rounded-xl shadow-2xl overflow-hidden">
                                        {searchSuggestions.map(item => (
                                            <div
                                                key={item.product_id}
                                                className="px-3 py-2 border-b border-silver/10 last:border-0 hover:bg-gold/40 cursor-pointer text-white text-xs transition-colors"
                                            >
                                                <span>{item.name}</span>
                                                <span className="text-gold text-[10px] mr-1">({item.product_id})</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Search by select */}
                            <select
                                name="searchBy"
                                defaultValue={searchBy}
                                className="px-2 py-2 bg-[#0a0a0c] border border-silver/30 rounded-full text-white hover:border-gold hover:bg-gold/40 focus:outline-none focus:border-gold text-xs appearance-none min-w-[60px] transition-all cursor-pointer"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20' stroke='%23DBA935'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                                    backgroundPosition: 'left 0.5rem center',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundSize: '0.8rem',
                                    paddingLeft: '1.5rem'
                                }}
                            >
                                <option value="name" className="bg-[#0a0a0c] text-white hover:bg-gold/40">Name</option>
                                <option value="code" className="bg-[#0a0a0c] text-white hover:bg-gold/40">Code</option>
                            </select>

                            {/* Category select */}
                            <select
                                name="category"
                                defaultValue={category}
                                className="px-2 py-2 bg-[#0a0a0c] border border-silver/30 rounded-full text-white hover:border-gold hover:bg-gold/40 focus:outline-none focus:border-gold text-xs appearance-none min-w-[50px] transition-all cursor-pointer"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20' stroke='%23DBA935'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                                    backgroundPosition: 'left 0.5rem center',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundSize: '0.8rem',
                                    paddingLeft: '1.5rem'
                                }}
                            >
                                <option value="" className="bg-[#0a0a0c] text-white hover:bg-gold/40">Cat</option>
                                {uniqueCategories.map((cat) => (
                                    <option key={cat} value={cat} className="bg-[#0a0a0c] text-white hover:bg-gold/40">{cat}</option>
                                ))}
                            </select>

                            {/* Quantity filter */}
                            <select
                                name="lowStock"
                                defaultValue={lowStock}
                                className="px-2 py-2 bg-[#0a0a0c] border border-silver/30 rounded-full text-white hover:border-gold hover:bg-gold/40 focus:outline-none focus:border-gold text-xs appearance-none min-w-[50px] transition-all cursor-pointer"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20' stroke='%23DBA935'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                                    backgroundPosition: 'left 0.5rem center',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundSize: '0.8rem',
                                    paddingLeft: '1.5rem'
                                }}
                            >
                                <option value="" className="bg-[#0a0a0c] text-white hover:bg-gold/40">Qty</option>
                                <option value="5" className="bg-[#0a0a0c] text-white hover:bg-gold/40">5</option>
                                <option value="10" className="bg-[#0a0a0c] text-white hover:bg-gold/40">10</option>
                                <option value="20" className="bg-[#0a0a0c] text-white hover:bg-gold/40">20</option>
                                <option value="50" className="bg-[#0a0a0c] text-white hover:bg-gold/40">50</option>
                            </select>

                            {/* Price filter */}
                            <div className="flex items-center gap-0.5 bg-[#0a0a0c] border border-silver/30 rounded-full px-2 py-1">
                                <span className="text-silver text-[8px]">$</span>
                                <input
                                    type="number"
                                    name="minPrice"
                                    defaultValue={minPrice}
                                    placeholder="0"
                                    className="w-10 px-1 py-1 bg-transparent border border-silver/30 rounded-full text-white placeholder-silver/50 focus:outline-none focus:border-gold text-[8px]"
                                />
                                <span className="text-silver text-[8px]">-</span>
                                <input
                                    type="number"
                                    name="maxPrice"
                                    defaultValue={maxPrice}
                                    placeholder="0"
                                    className="w-10 px-1 py-1 bg-transparent border border-silver/30 rounded-full text-white placeholder-silver/50 focus:outline-none focus:border-gold text-[8px]"
                                />
                            </div>

                            {/* Search button */}
                            <button
                                type="submit"
                                className="w-7 h-7 bg-transparent rounded-full flex items-center justify-center hover:bg-gold/20 transition-colors duration-200 flex-shrink-0"
                                title={t.search}
                            >
                                <Image
                                    src="/assets/images/search.ico"
                                    alt="بحث"
                                    width={18}
                                    height={18}
                                    className="w-4 h-4 object-contain"
                                />
                            </button>

                            {/* Add button */}
                            <button
                                type="button"
                                onClick={handleAdd}
                                className="w-7 h-7 bg-transparent rounded-full flex items-center justify-center hover:bg-gold/20 transition-colors duration-200 flex-shrink-0"
                                title={t.add}
                            >
                                <Image
                                    src="/assets/images/add.png"
                                    alt="إضافة"
                                    width={18}
                                    height={18}
                                    className="w-4 h-4 object-contain"
                                />
                            </button>
                        </div>
                    </div>
                </form>

                {/* ==================== TABLE HEADER (FLOATING) ==================== */}
                <div
                    ref={tableHeaderRef}
                    className="sticky top-0 z-40 overflow-hidden bg-[#1a1a1e]/90 backdrop-blur-md border border-gold/30 rounded-lg mb-2 shadow-lg"
                    style={{ top: '0' }}
                >
                    <div
                        ref={floatingTableHeaderRef}
                        className="inline-block min-w-full transition-transform duration-0"
                        style={{ transform: `translateX(-${tableScrollLeft}px)` }}
                    >
                        <div className="bg-gradient-to-b from-[#2a2a2e] to-[#1a1a1e] border-b-2 border-gold/30 p-1.5">
                            <div className="grid grid-cols-8 gap-0.5 text-[9px] text-gold font-alata font-bold tracking-wide min-w-[650px]">
                                <div className="col-span-1 text-center px-0.5">{t.productCode}</div>
                                <div className="col-span-2 text-center px-0.5">{t.productName}</div>
                                <div className="col-span-1 text-center px-0.5">{t.category}</div>
                                <div className="col-span-1 text-center px-0.5">{t.sellPrice}</div>
                                <div className="col-span-1 text-center px-0.5">{t.costPrice}</div>
                                <div className="col-span-1 text-center px-0.5">{t.quantity}</div>
                                <div className="col-span-1 text-center px-0.5">{t.unit}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ==================== TABLE ==================== */}
                <div className="relative w-full">
                    <div
                        ref={tableContainerRef}
                        className="overflow-auto scrollbar-thin scrollbar-thumb-gold/50 scrollbar-track-transparent max-h-[350px]"
                        style={{ scrollBehavior: 'smooth' }}
                    >
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gold"></div>
                                <p className="text-silver text-xs mt-2">{t.loading}</p>
                            </div>
                        ) : (
                            <DataTable
                                tableName="products"
                                columns={config.columns.map(col => ({
                                    ...col,
                                    className: 'text-[8px] px-1 py-1'
                                }))}
                                data={data}
                                onEdit={handleEdit}
                                onDelete={(id) => softDelete(id, 'product_id')}
                                idColumn="product_id"
                                language={language}
                            />
                        )}
                    </div>

                    {/* Scroll buttons */}
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 pointer-events-none flex justify-between px-1">
                        {showLeftScroll && (
                            <button
                                onClick={scrollLeft}
                                className="pointer-events-auto w-7 h-7 flex items-center justify-center bg-gold/20 hover:bg-gold/40 rounded-full transition-colors"
                                title="التمرير لليسار"
                            >
                                <Image
                                    src="/assets/images/left.svg"
                                    alt="التمرير لليسار"
                                    width={28}
                                    height={28}
                                    className="w-6 h-6 object-contain"
                                />
                            </button>
                        )}

                        {showRightScroll && (
                            <button
                                onClick={scrollRight}
                                className="pointer-events-auto w-7 h-7 flex items-center justify-center bg-gold/20 hover:bg-gold/40 rounded-full transition-colors"
                                title="التمرير لليمين"
                            >
                                <Image
                                    src="/assets/images/right.svg"
                                    alt="التمرير لليمين"
                                    width={28}
                                    height={28}
                                    className="w-6 h-6 object-contain"
                                />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <ProductModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                onSuccess={handleModalSuccess}
                product={editingProduct}
                language={language}
            />

            <WeatherPopup
                isOpen={isWeatherOpen}
                onClose={() => setIsWeatherOpen(false)}
                weatherData={weatherData}
                loading={weatherLoading}
                language={language}
            />
        </div>
    )
}