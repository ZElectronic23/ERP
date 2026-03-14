'use client';

import { useTranslations } from 'next-intl';
import { useTableData } from '@/hooks/useTableData';
import { useDelete } from '@/hooks/useDelete';
import DataTable from '@/components/data/DataTable';
import ProductModal from '@/components/modals/ProductModal';
import Pagination from '@/components/data/Pagination';
import Header from '@/components/Header'; // ✅ استخدام الهيدر الموحد
import { tableConfigs } from '@/config/tables';
import type { Column } from '@/config/tables';
import { useState, useEffect, useRef, useCallback, use } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import UserMenu from '@/components/UserMenu';
import CategoryDropdown from '@/components/CategoryDropdown';
import Dropdown from '@/components/ui/Dropdown';
import { useRouter, usePathname } from 'next/navigation';

interface ProductsPageProps {
    params: Promise<{ locale: string }>;
}

export default function ProductsPage({ params }: ProductsPageProps) {
    const { locale } = use(params);
    const t = useTranslations();
    const router = useRouter();
    const pathname = usePathname();
    const language = locale as 'ar' | 'en';

    // ===== Refs =====
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const tableHeaderRef = useRef<HTMLTableSectionElement>(null);
    const floatingScrollRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // ===== State =====
    const [filters, setFilters] = useState({
        search: '', searchBy: 'name', category: '', minPrice: '', maxPrice: '', lowStock: ''
    });
    const [showLeftScroll, setShowLeftScroll] = useState(false);
    const [showRightScroll, setShowRightScroll] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [imagesLoaded, setImagesLoaded] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [isWeatherOpen, setIsWeatherOpen] = useState(false); // قد لا نحتاجه الآن لكن نتركه
    const [weatherData, setWeatherData] = useState<any>(null);
    const [weatherLoading, setWeatherLoading] = useState(false);
    const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const autocompleteRef = useRef<HTMLDivElement>(null);

    // ===== Pagination =====
    const [currentPage, setCurrentPage] = useState(1);
    const [pageLimit, setPageLimit] = useState(50);
    const [paginatedData, setPaginatedData] = useState<any[]>([]);

    // ===== Data =====
    const { data, loading, error, refresh, totalCount } = useTableData('products', {
        search: filters.searchBy === 'code' ? '' : filters.search,
        code: filters.searchBy === 'code' ? filters.search : '',
        filters: { category: filters.category },
        priceRange: { min: filters.minPrice, max: filters.maxPrice },
        lowStock: filters.lowStock ? parseInt(filters.lowStock) : null,
        orderBy: 'product_id',
        orderDirection: 'asc',
    });
    const { softDelete } = useDelete('products', () => refresh());
    const config = tableConfigs.products;
    const uniqueCategories = Array.from(new Set(
        data.map((p: any) => p.category).filter((c: any): c is string => Boolean(c))
    ));

    useEffect(() => {
        const start = (currentPage - 1) * pageLimit;
        const end = start + pageLimit;
        setPaginatedData(data.slice(start, end));
    }, [data, currentPage, pageLimit]);

    const totalPages = Math.ceil(data.length / pageLimit) || 1;

    // ===== Init =====
    useEffect(() => {
        setIsClient(true);
        const urls = [
            '/assets/images/cloud.svg', '/assets/images/left.svg', '/assets/images/right.svg',
            '/assets/images/search.ico', '/assets/images/add.png', '/assets/images/ERP.svg',
            '/assets/images/BG.png', '/assets/images/product.svg'
        ];
        let n = 0;
        urls.forEach(url => {
            const img = new window.Image(); img.src = url;
            img.onload = img.onerror = () => { if (++n === urls.length) setImagesLoaded(true); };
        });
    }, []);

    // ===== مزامنة التمرير الأفقي =====
    useEffect(() => {
        const container = tableContainerRef.current;
        const floatingHeader = floatingScrollRef.current;
        if (!container || !floatingHeader) return;

        const onContainerScroll = () => {
            floatingHeader.scrollLeft == container.scrollLeft;
            const { scrollLeft, scrollWidth, clientWidth } = container;
            setShowLeftScroll(scrollLeft > 10);
            setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 10);
        };

        const onFloatingScroll = () => {
            container.scrollLeft = floatingHeader.scrollLeft;
        };

        container.addEventListener('scroll', onContainerScroll, { passive: true });
        floatingHeader.addEventListener('scroll', onFloatingScroll, { passive: true });

        onContainerScroll();

        return () => {
            container.removeEventListener('scroll', onContainerScroll);
            floatingHeader.removeEventListener('scroll', onFloatingScroll);
        };
    }, []);

    // مزامنة عروض الأعمدة
    const syncColumnWidths = useCallback(() => {
        const origThs = tableHeaderRef.current?.querySelectorAll('th');
        const floatThs = floatingScrollRef.current?.querySelectorAll('th');
        if (!origThs?.length || !floatThs?.length) return;
        origThs.forEach((th, i) => {
            const fth = floatThs[i] as HTMLElement | undefined;
            if (!fth) return;
            const w = (th as HTMLElement).offsetWidth;
            fth.style.width = `${w}px`;
            fth.style.minWidth = `${w}px`;
            fth.style.maxWidth = `${w}px`;
        });
    }, []);

    useEffect(() => {
        if (loading) return;
        const t1 = setTimeout(syncColumnWidths, 150);
        const t2 = setTimeout(syncColumnWidths, 500);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [data.length, loading, syncColumnWidths]);

    // ===== Autocomplete =====
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                !autocompleteRef.current?.contains(target) &&
                !searchInputRef.current?.contains(target)
            ) setShowAutocomplete(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ===== Autocomplete Search =====
    const searchProducts = async (val: string) => {
        if (val.length < 2) { setSearchSuggestions([]); setShowAutocomplete(false); return; }
        const { data: r } = await supabase.from('products')
            .select('product_id, name')
            .ilike('name', `%${val}%`)
            .limit(6);
        if (r?.length) { setSearchSuggestions(r); setShowAutocomplete(true); }
        else { setSearchSuggestions([]); setShowAutocomplete(false); }
    };

    const handleSuggestionClick = (item: any) => {
        const name = item.name as string;
        if (searchInputRef.current) searchInputRef.current.value = name;
        setShowAutocomplete(false);
        setSearchSuggestions([]);
        setFilters(f => ({ ...f, search: name, searchBy: 'name' }));
        setCurrentPage(1);
    };

    // ===== Apply Filters =====
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setFilters({
            search: (fd.get('search') as string) || '',
            searchBy: (fd.get('searchBy') as string) || 'name',
            category: (fd.get('category') as string) || '',
            minPrice: (fd.get('minPrice') as string) || '',
            maxPrice: (fd.get('maxPrice') as string) || '',
            lowStock: (fd.get('lowStock') as string) || '',
        });
        setCurrentPage(1);
        setShowAutocomplete(false);
    };

    const handleReset = () => {
        setFilters({ search: '', searchBy: 'name', category: '', minPrice: '', maxPrice: '', lowStock: '' });
        setSearchSuggestions([]);
        setShowAutocomplete(false);
        setCurrentPage(1);
        if (searchInputRef.current) searchInputRef.current.value = '';
    };

    const handleEdit = (p: any) => { setEditingProduct(p); setIsModalOpen(true); };
    const handleAdd = () => { setEditingProduct(null); setIsModalOpen(true); };
    const handleClose = () => { setIsModalOpen(false); setEditingProduct(null); };
    const handleSuccess = () => { refresh(); handleClose(); };

    const doScrollLeft = () => tableContainerRef.current?.scrollBy({ left: -300, behavior: 'smooth' });
    const doScrollRight = () => tableContainerRef.current?.scrollBy({ left: 300, behavior: 'smooth' });

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
    };

    const baseColumns = config.columns.filter(col => col.key !== 'image');

    const columns: Column[] = [
        imageColumn,
        ...baseColumns.map((col: any) => ({
            ...col,
            type: col.type || 'text',
            className: 'text-[12px] px-1 py-1'
        }))
    ];

    const colLabels = columns.map(col => {
        const map: Record<string, Record<string, string>> = {
            image: { ar: 'صورة', en: 'Image' },
            product_id: { ar: t('productCode'), en: t('productCode') },
            name: { ar: t('productName'), en: t('productName') },
            category: { ar: t('category'), en: t('category') },
            sell_price: { ar: t('sellPrice'), en: t('sellPrice') },
            cost_price: { ar: t('costPrice'), en: t('costPrice') },
            stock_quantity: { ar: t('quantity'), en: t('quantity') },
            unit: { ar: t('unit'), en: t('unit') },
        };
        return map[col.key]?.[language] ?? col.label ?? col.key;
    });

    // ===== Loading / Error Screens =====
    if (!isClient || !imagesLoaded) {
        return (
            <div className="min-h-screen flex items-center justify-center"
                style={{ backgroundImage: "url('/assets/images/BG.png')", backgroundSize: 'cover', backgroundAttachment: 'fixed' }}>
                <div className="bg-darkwhite/70 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-gold/30 flex flex-col items-center gap-4">
                    <div className="w-20 h-20 relative">
                        <Image src="/assets/images/ERP.svg" alt="ERP" fill className="object-contain animate-pulse" priority />
                    </div>
                    <div className="text-gold font-alata text-xl animate-pulse">{t('loading')}</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen p-4 flex items-center justify-center"
                style={{ backgroundImage: "url('/assets/images/BG.png')", backgroundSize: 'cover' }}
                dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <div className="bg-[#1a1a1e]/90 rounded-2xl p-6 text-white border border-silver/30">
                    <p className="text-gold">{t('error')}: {error.message}</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen"
            style={{ backgroundImage: "url('/assets/images/BG.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
        >


            <div className="p-4 md:p-6">
                <div className="bg-darkwhite/0 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-white/10">
                    <div className="mb-3">
                        <h1 className="text-lg font-alata text-gold drop-shadow-lg">{t('products')}</h1>
                    </div>

                    {/* ==================== SEARCH BAR ==================== */}
                    <form onSubmit={handleSubmit} className="mb-6 w-full" style={{ position: 'relative', zIndex: 50 }}>
                        <div className="bg-[#1a1a1e]/90 backdrop-blur-xl rounded-xl border border-gold/30 p-2 shadow-xl">
                            <div className="flex flex-wrap items-center gap-1">
                                {/* Input + Autocomplete */}
                                <div className="flex-1 min-w-[150px] relative">
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        name="search"
                                        autoComplete="off"
                                        defaultValue={filters.search}
                                        onChange={e => searchProducts(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Escape') setShowAutocomplete(false);
                                            if (e.key === 'Enter') setShowAutocomplete(false);
                                        }}
                                        className="w-full px-3 py-1.5 bg-[#0a0a0c] border border-silver/30 rounded-full text-white text-xs focus:outline-none focus:border-gold transition-all"
                                    />
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
                                                        e.preventDefault();
                                                        handleSuggestionClick(item);
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
                                <Dropdown
                                    options={[
                                        { value: 'name', label: t('byName') },
                                        { value: 'code', label: t('byCode') }
                                    ]}
                                    value={filters.searchBy}
                                    onChange={(val) => setFilters(f => ({ ...f, searchBy: val }))}
                                    language={language}
                                    className="min-w-[65px]"
                                />

                                {/* CategoryDropdown */}
                                <CategoryDropdown
                                    categories={uniqueCategories}
                                    selectedCategory={filters.category}
                                    onSelectCategory={(cat) => setFilters(f => ({ ...f, category: cat }))}
                                    language={language}
                                />

                                {/* lowStock */}
                                <Dropdown
                                    options={[
                                        { value: '', label: t('quantity') },
                                        { value: '5', label: '5' },
                                        { value: '10', label: '10' },
                                        { value: '20', label: '20' },
                                        { value: '50', label: '50' }
                                    ]}
                                    value={filters.lowStock}
                                    onChange={(val) => setFilters(f => ({ ...f, lowStock: val }))}
                                    language={language}
                                    className="min-w-[60px]"
                                />

                                {/* price range */}
                                <div className="flex items-center gap-0.5 bg-[#0a0a0c] border border-silver/30 rounded-full px-1.5 py-1">
                                    <span className="text-silver text-[9px]">$</span>
                                    <input
                                        type="number"
                                        name="minPrice"
                                        defaultValue={filters.minPrice}
                                        placeholder="0"
                                        className="w-9 bg-transparent text-white text-[9px] focus:outline-none"
                                    />
                                    <span className="text-silver text-[9px]">-</span>
                                    <input
                                        type="number"
                                        name="maxPrice"
                                        defaultValue={filters.maxPrice}
                                        placeholder="0"
                                        className="w-9 bg-transparent text-white text-[9px] focus:outline-none"
                                    />
                                </div>

                                {/* Search */}
                                <button type="submit" title={t('search')}
                                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gold/20 transition-colors flex-shrink-0">
                                    <Image src="/assets/images/search.ico" alt={t('search')} width={20} height={20} className="w-5 h-5 object-contain" />
                                </button>

                                {/* Reset */}
                                <button type="button" onClick={handleReset} title={t('reset')}
                                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500/20 transition-colors flex-shrink-0 text-silver hover:text-red-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                    </svg>
                                </button>

                                {/* Add */}
                                <button type="button" onClick={handleAdd} title={t('add')}
                                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gold/20 transition-colors flex-shrink-0">
                                    <Image src="/assets/images/add.png" alt={t('add')} width={20} height={20} className="w-5 h-5 object-contain" />
                                </button>

                                {/* Deleted products */}
                                <button
                                    type="button"
                                    onClick={() => router.push(`/${locale}/products/deleted`)}
                                    title={t('deletedProducts')}
                                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500/20 transition-colors flex-shrink-0"
                                >
                                    <Image src="/assets/images/delete.svg" alt={t('deletedProducts')} width={20} height={20} className="w-5 h-5 object-contain" />
                                </button>
                            </div>
                        </div>
                    </form>

                    {/* ==================== TABLE ==================== */}
                    <div className="relative w-full">
                        {/* Floating Header */}
                        <div
                            ref={floatingScrollRef}
                            className="absolute top-0 left-0 right-0 overflow-x-auto scrollbar-none bg-[#2a2a2a] border-b border-[#3E3B3F]"
                            style={{ zIndex: 10 }}
                            dir={language === 'ar' ? 'rtl' : 'ltr'}
                        >
                            <table style={{ tableLayout: 'fixed', width: '100%', minWidth: '800px' }}>
                                <thead>
                                    <tr>
                                        {colLabels.map((label, i) => (
                                            <th
                                                key={i}
                                                className="px-2 py-2 text-xs font-medium text-silver"
                                                style={{ textAlign: language === 'ar' ? 'right' : 'left', maxWidth: '150px' }}
                                            >
                                                {label}
                                            </th>
                                        ))}
                                        <th className="px-2 py-2 text-xs font-medium text-silver text-center" style={{ maxWidth: '100px' }}>
                                            {t('edit')}
                                        </th>
                                    </tr>
                                </thead>
                            </table>
                        </div>

                        {/* Original Table */}
                        <div
                            ref={tableContainerRef}
                            className="overflow-auto scrollbar-thin scrollbar-thumb-gold/50 scrollbar-track-transparent"
                            style={{ maxHeight: 'calc(100vh - 280px)' }}
                        >
                            {loading ? (
                                <div className="p-8 text-center">
                                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gold" />
                                    <p className="text-silver text-xs mt-2">{t('loading')}</p>
                                </div>
                            ) : (
                                <DataTable
                                    tableName="products"
                                    columns={columns}
                                    data={paginatedData}
                                    onEdit={handleEdit}
                                    onDelete={(id: string) => softDelete(id, 'product_id')}
                                    idColumn="product_id"
                                    language={language}
                                    tableHeaderRef={tableHeaderRef}
                                    loading={loading}
                                />
                            )}
                        </div>

                        {/* أزرار التمرير الجانبية */}
                        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 pointer-events-none flex justify-between px-1" style={{ zIndex: 5 }}>
                            {showLeftScroll && (
                                <button onClick={doScrollLeft} className="pointer-events-auto w-7 h-7 flex items-center justify-center bg-gold/20 hover:bg-gold/40 rounded-full transition-colors">
                                    <Image src="/assets/images/left.svg" alt={t('scrollLeft')} width={28} height={28} className="w-6 h-6 object-contain" />
                                </button>
                            )}
                            {showRightScroll && (
                                <button onClick={doScrollRight} className="pointer-events-auto w-7 h-7 flex items-center justify-center bg-gold/20 hover:bg-gold/40 rounded-full transition-colors">
                                    <Image src="/assets/images/right.svg" alt={t('scrollRight')} width={28} height={28} className="w-6 h-6 object-contain" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Pagination */}
                    <div className="mt-4">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalCount={data.length}
                            limit={pageLimit}
                            onPageChange={setCurrentPage}
                            onLimitChange={setPageLimit}
                            language={language}
                            limitOptions={[10, 25, 50, 100]}
                        />
                    </div>
                </div>
            </div>

            <ProductModal
                isOpen={isModalOpen} onClose={handleClose} onSuccess={handleSuccess}
                product={editingProduct} language={language}
            />
        </div>
    );
}