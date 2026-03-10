'use client';

import { useTableData } from '@/hooks/useTableData'
import { useDelete } from '@/hooks/useDelete'
import DataTable from '@/components/data/DataTable'
import ProductModal from '@/components/modals/ProductModal'
import { tableConfigs } from '@/config/tables'
import type { Column } from '@/config/tables'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { translations, Language } from '@/lib/translations'
import { supabase } from '@/lib/supabaseClient'
import Image from 'next/image'
import WeatherPopup from '@/components/WeatherPopup'
import { fetchWeatherData } from '@/lib/weather'
import UserMenu from '@/components/UserMenu'

export default function ProductsPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const tableContainerRef = useRef<HTMLDivElement>(null) // للتمرير الرأسي فقط
    const [showLeftScroll, setShowLeftScroll] = useState(false)
    const [showRightScroll, setShowRightScroll] = useState(false)
    const [tableScrollLeft, setTableScrollLeft] = useState(0)

    // ==================== STATES ====================
    const [isClient, setIsClient] = useState(false)
    const [imagesLoaded, setImagesLoaded] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<any>(null)
    const [isDateExpanded, setIsDateExpanded] = useState(false)

    // Weather states
    const [isWeatherOpen, setIsWeatherOpen] = useState(false)
    const [weatherData, setWeatherData] = useState<any>(null)
    const [weatherLoading, setWeatherLoading] = useState(false)

    // Autocomplete state
    const [searchSuggestions, setSearchSuggestions] = useState<any[]>([])
    const [showAutocomplete, setShowAutocomplete] = useState(false)

    // ==================== LANGUAGE ====================
    const [language, setLanguage] = useState<Language>('ar')
    const t = translations[language]

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

    // ==================== UNIQUE CATEGORIES ====================
    const uniqueCategories = Array.from(new Set(
        data
            .map(p => p.category)
            .filter((cat): cat is string => Boolean(cat) && typeof cat === 'string')
    ))

    // ==================== DATE FORMATTING ====================
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

    // ==================== EFFECTS ====================
    useEffect(() => {
        setIsClient(true)

        const imageUrls = [
            '/assets/images/cloud.svg',
            '/assets/images/left.svg',
            '/assets/images/right.svg',
            '/assets/images/search.ico',
            '/assets/images/add.png',
            '/assets/images/ERP.svg',
            '/assets/images/BG.png',
            '/assets/images/product.svg'
        ]

        let loadedCount = 0
        const totalImages = imageUrls.length

        imageUrls.forEach(url => {
            const img = new window.Image()
            img.src = url
            img.onload = () => {
                loadedCount++
                if (loadedCount === totalImages) {
                    setImagesLoaded(true)
                }
            }
            img.onerror = () => {
                loadedCount++
                if (loadedCount === totalImages) {
                    setImagesLoaded(true)
                }
            }
        })
    }, [])

    useEffect(() => {
        try {
            const savedLang = localStorage.getItem('preferred-language') as Language || 'ar'
            setLanguage(savedLang)
            document.documentElement.lang = savedLang
            document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr'
        } catch (e) {
            console.log('localStorage not available')
        }
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
                const newScrollLeft = tableContainerRef.current.scrollLeft
                setTableScrollLeft(newScrollLeft)

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

    // ==================== SEARCH ====================
    const searchProducts = async (input: string) => {
        if (input.length < 2) {
            setSearchSuggestions([])
            setShowAutocomplete(false)
            return
        }

        const { data } = await supabase
            .from('products')
            .select('product_id, name')
            .ilike('name', `%${input}%`)
            .limit(5)

        setSearchSuggestions(data || [])
        setShowAutocomplete(true)
    }

    const handleSearchBlur = () => {
        setTimeout(() => setShowAutocomplete(false), 200)
    }

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            setShowAutocomplete(false)
        }
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
        setShowAutocomplete(false)
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
        try {
            localStorage.setItem('preferred-language', newLang)
        } catch (e) { }
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

    if (!isClient || !imagesLoaded) {
        return (
            <div
                className="min-h-screen flex items-center justify-center"
                style={{
                    backgroundImage: "url('/assets/images/BG.png')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundAttachment: 'fixed'
                }}
            >
                <div className="bg-darkwhite/70 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-gold/30">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 relative">
                            <Image
                                src="/assets/images/ERP.svg"
                                alt="ERP"
                                fill
                                className="object-contain animate-pulse"
                                priority
                            />
                        </div>
                        <div className="text-gold font-alata text-xl animate-pulse">جاري التحميل...</div>
                    </div>
                </div>
            </div>
        )
    }

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

    const imageColumn: Column = {
        key: 'image',
        label: language === 'ar' ? 'صورة' : 'Image',
        type: 'image',
        render: (value: any, row: any) => (
            <div className="flex justify-center">
                {row.image ? (
                    <Image src={row.image} alt={row.name} width={30} height={30} className="rounded object-cover" />
                ) : (
                    <Image src="/assets/images/product.svg" alt="product" width={30} height={30} className="rounded object-cover opacity-70" />
                )}
            </div>
        ),
        className: 'text-center'
    };

    const columns: Column[] = [
        imageColumn,
        ...config.columns.map(col => ({
            ...col,
            type: col.type || 'text',
            className: 'text-[12px] px-1 py-1'
        }))
    ];

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
        >
            <div className="min-h-screen bg-darkwhite/70 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-white/10">

                {/* ==================== HEADER ==================== */}
                <div className="relative w-full mb-2" style={{ minHeight: '70px' }}>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2">
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
                            width={140}
                            height={140}
                            className="w-28 h-28 md:w-32 md:h-32 object-contain"
                            priority
                        />
                    </div>

                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <button
                            onClick={toggleLanguage}
                            className="px-3 py-1 rounded-full border border-gold/30 text-gold hover:bg-gold/40 hover:text-darkwhite transition-colors text-sm font-medium"
                        >
                            {language === 'ar' ? 'EN' : 'AR'}
                        </button>

                        <UserMenu language={language} onLanguageToggle={toggleLanguage} />
                    </div>
                </div>

                <div className="mb-3 w-full">
                    <h1 className="text-lg font-alata text-gold drop-shadow-lg">{t.products}</h1>
                </div>

                {/* Search and filters */}
                <form onSubmit={handleSubmit} className="mb-6 w-full relative z-50">
                    <div className="bg-[#1a1a1e]/90 backdrop-blur-xl rounded-xl border border-gold/30 p-2 shadow-xl">
                        <div className="flex flex-wrap items-center gap-1">
                            <div className="flex-1 min-w-[150px] relative">
                                <div className="relative">
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-silver">
                                        <span className="material-icons text-xs">search</span>
                                    </span>
                                    <input
                                        type="text"
                                        name="search"
                                        defaultValue={search}
                                        onChange={(e) => searchProducts(e.target.value)}
                                        onBlur={handleSearchBlur}
                                        onKeyDown={handleSearchKeyDown}
                                        placeholder=""
                                        className="w-full pr-7 pl-1.5 py-1.5 bg-[#0a0a0c] border border-silver/30 rounded-full text-white text-xs focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-all hover:bg-[#1a1a1e]"
                                    />
                                </div>
                                {showAutocomplete && searchSuggestions.length > 0 && (
                                    <div className="absolute z-[100] top-full mt-1 w-full bg-[#1a1a1e]/95 backdrop-blur-md border border-gold/30 rounded-xl shadow-2xl overflow-hidden">
                                        {searchSuggestions.map(item => (
                                            <div
                                                key={item.product_id}
                                                className="px-2 py-1.5 border-b border-silver/10 last:border-0 hover:bg-gold/40 cursor-pointer text-white text-[10px] transition-colors"
                                            >
                                                <span>{item.name}</span>
                                                <span className="text-gold text-[8px] mr-1">({item.product_id})</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <select
                                name="searchBy"
                                defaultValue={searchBy}
                                className="px-2 py-1.5 bg-[#0a0a0c] border border-silver/30 rounded-full text-white hover:border-gold hover:bg-gold/40 focus:outline-none focus:border-gold text-[11px] appearance-none min-w-[65px] transition-all cursor-pointer"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20' stroke='%23DBA935'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                                    backgroundPosition: 'left 0.5rem center',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundSize: '0.7rem',
                                    paddingLeft: '1.5rem'
                                }}
                            >
                                <option value="name" className="bg-[#0a0a0c] text-white hover:bg-gold/40">Name</option>
                                <option value="code" className="bg-[#0a0a0c] text-white hover:bg-gold/40">Code</option>
                            </select>

                            <select
                                name="category"
                                defaultValue={category}
                                className="px-2 py-1.5 bg-[#0a0a0c] border border-silver/30 rounded-full text-white hover:border-gold hover:bg-gold/40 focus:outline-none focus:border-gold text-[11px] appearance-none min-w-[70px] transition-all cursor-pointer"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20' stroke='%23DBA935'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                                    backgroundPosition: 'left 0.5rem center',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundSize: '0.7rem',
                                    paddingLeft: '1.5rem'
                                }}
                            >
                                <option value="" className="bg-[#0a0a0c] text-white hover:bg-gold/40">Category</option>
                                {uniqueCategories.map((cat) => (
                                    <option key={cat} value={cat} className="bg-[#0a0a0c] text-white hover:bg-gold/40">{cat}</option>
                                ))}
                            </select>

                            <select
                                name="lowStock"
                                defaultValue={lowStock}
                                className="px-2 py-1.5 bg-[#0a0a0c] border border-silver/30 rounded-full text-white hover:border-gold hover:bg-gold/40 focus:outline-none focus:border-gold text-[11px] appearance-none min-w-[60px] transition-all cursor-pointer"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20' stroke='%23DBA935'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                                    backgroundPosition: 'left 0.5rem center',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundSize: '0.7rem',
                                    paddingLeft: '1.5rem'
                                }}
                            >
                                <option value="" className="bg-[#0a0a0c] text-white hover:bg-gold/40">Quantity</option>
                                <option value="5" className="bg-[#0a0a0c] text-white hover:bg-gold/40">5</option>
                                <option value="10" className="bg-[#0a0a0c] text-white hover:bg-gold/40">10</option>
                                <option value="20" className="bg-[#0a0a0c] text-white hover:bg-gold/40">20</option>
                                <option value="50" className="bg-[#0a0a0c] text-white hover:bg-gold/40">50</option>
                            </select>

                            <div className="flex items-center gap-0.5 bg-[#0a0a0c] border border-silver/30 rounded-full px-1.5 py-1">
                                <span className="text-silver text-[9px]">$</span>
                                <input
                                    type="number"
                                    name="minPrice"
                                    defaultValue={minPrice}
                                    placeholder="0"
                                    className="w-9 px-0.5 py-0.5 bg-transparent border border-silver/30 rounded-full text-white placeholder-silver/50 focus:outline-none focus:border-gold text-[9px]"
                                />
                                <span className="text-silver text-[9px]">-</span>
                                <input
                                    type="number"
                                    name="maxPrice"
                                    defaultValue={maxPrice}
                                    placeholder="0"
                                    className="w-9 px-0.5 py-0.5 bg-transparent border border-silver/30 rounded-full text-white placeholder-silver/50 focus:outline-none focus:border-gold text-[9px]"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-8 h-8 bg-transparent rounded-full flex items-center justify-center hover:bg-gold/20 transition-colors duration-200 flex-shrink-0"
                                title={t.search}
                            >
                                <Image
                                    src="/assets/images/search.ico"
                                    alt="بحث"
                                    width={20}
                                    height={20}
                                    className="w-5 h-5 object-contain"
                                />
                            </button>

                            <button
                                type="button"
                                onClick={handleAdd}
                                className="w-8 h-8 bg-transparent rounded-full flex items-center justify-center hover:bg-gold/20 transition-colors duration-200 flex-shrink-0"
                                title={t.add}
                            >
                                <Image
                                    src="/assets/images/add.png"
                                    alt="إضافة"
                                    width={20}
                                    height={20}
                                    className="w-5 h-5 object-contain"
                                />
                            </button>
                        </div>
                    </div>
                </form>

                {/* Table Container */}
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
                                columns={columns}
                                data={data}
                                onEdit={handleEdit}
                                onDelete={(id) => softDelete(id, 'product_id')}
                                idColumn="product_id"
                                language={language}
                            />
                        )}
                    </div>

                    {/* Scroll Buttons */}
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