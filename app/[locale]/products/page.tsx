'use client';

import { useTranslations } from 'next-intl';
import { useTableData } from '@/hooks/useTableData';
import { useDelete } from '@/hooks/useDelete';
import DataTable from '@/components/data/DataTable';
import ProductModal from '@/components/modals/ProductModal';
import ServiceModal from '@/components/modals/ServiceModal';
import Pagination from '@/components/data/Pagination';
import type { Column } from '@/config/tables';
import { useState, useEffect, useRef, use } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import CategoryDropdown from '@/components/CategoryDropdown';
import Dropdown from '@/components/ui/Dropdown';
import { useRouter } from 'next/navigation';

interface ProductsPageProps {
    params: Promise<{ locale: string }>;
}

type TabKey = 'products' | 'services';

export default function ProductsPage({ params }: ProductsPageProps) {
    const { locale } = use(params);
    const t = useTranslations();
    const router = useRouter();
    const language = locale as 'ar' | 'en';

    // ===== Refs =====
    const searchInputRef = useRef<HTMLInputElement>(null);
    const autocompleteRef = useRef<HTMLDivElement>(null);

    // ===== Tab (المنتجات / الخدمات) =====
    const [activeTab, setActiveTab] = useState<TabKey>('products');
    const idColumn = activeTab === 'products' ? 'product_id' : 'service_id';

    // ===== State =====
    const [filters, setFilters] = useState({
        search: '', searchBy: 'name', category: '', minPrice: '', maxPrice: '', lowStock: ''
    });
    const [isClient, setIsClient] = useState(false);
    const [imagesLoaded, setImagesLoaded] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);

    // ===== Pagination =====
    const [currentPage, setCurrentPage] = useState(1);
    const [pageLimit, setPageLimit] = useState(50);
    const [paginatedData, setPaginatedData] = useState<any[]>([]);

    // ===== Data =====
    const { data, loading, error, refresh } = useTableData(activeTab, {
        search: filters.searchBy === 'code' ? '' : filters.search,
        searchBy: filters.searchBy as 'name' | 'code',
        code: filters.searchBy === 'code' ? filters.search : '',
        codeColumn: idColumn,
        filters: { category: filters.category },
        priceRange: { min: filters.minPrice, max: filters.maxPrice },
        lowStock: activeTab === 'products' && filters.lowStock ? parseInt(filters.lowStock) : null,
        orderBy: idColumn,
        orderDirection: 'asc',
    });
    const { softDelete } = useDelete(activeTab, () => refresh());

    const uniqueCategories = Array.from(new Set(
        data.map((p: any) => p.category).filter((c: any): c is string => Boolean(c))
    ));

    useEffect(() => {
        const start = (currentPage - 1) * pageLimit;
        setPaginatedData(data.slice(start, start + pageLimit));
    }, [data, currentPage, pageLimit]);

    const totalPages = Math.ceil(data.length / pageLimit) || 1;

    // إعادة الترقيم للصفحة الأولى عند تغيير أي فلتر أو التبويب
    useEffect(() => {
        setCurrentPage(1);
    }, [filters.search, filters.searchBy, filters.category, filters.minPrice, filters.maxPrice, filters.lowStock, activeTab]);

    // ===== Init: preload images + honor ?tab=services =====
    useEffect(() => {
        setIsClient(true);
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('tab') === 'services') setActiveTab('services');
        } catch { /* ignore */ }
        const urls = [
            '/assets/images/search.ico', '/assets/images/add.png',
            '/assets/images/ERP.svg', '/assets/images/BG.png', '/assets/images/product.svg'
        ];
        let n = 0;
        urls.forEach(url => {
            const img = new window.Image(); img.src = url;
            img.onload = img.onerror = () => { if (++n === urls.length) setImagesLoaded(true); };
        });
    }, []);

    // ===== Close autocomplete on outside click =====
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (!autocompleteRef.current?.contains(target) && !searchInputRef.current?.contains(target)) {
                setShowAutocomplete(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ===== Switch tab: reset filters & page =====
    const switchTab = (tab: TabKey) => {
        if (tab === activeTab) return;
        setActiveTab(tab);
        setFilters({ search: '', searchBy: 'name', category: '', minPrice: '', maxPrice: '', lowStock: '' });
        setSearchSuggestions([]);
        setShowAutocomplete(false);
        setCurrentPage(1);
        if (searchInputRef.current) searchInputRef.current.value = '';
    };

    // ===== Autocomplete =====
    const searchItems = async (val: string) => {
        if (val.length < 2) { setSearchSuggestions([]); setShowAutocomplete(false); return; }
        const { data: r } = await supabase.from(activeTab)
            .select(`${idColumn}, name`)
            .is('deleted_at', null)
            .ilike('name', `%${val}%`)
            .limit(6);
        if (r?.length) { setSearchSuggestions(r); setShowAutocomplete(true); }
        else { setSearchSuggestions([]); setShowAutocomplete(false); }
    };

    const handleSuggestionClick = (item: any) => {
        if (searchInputRef.current) searchInputRef.current.value = item.name;
        setShowAutocomplete(false);
        setSearchSuggestions([]);
        setFilters(f => ({ ...f, search: item.name, searchBy: 'name' }));
        setCurrentPage(1);
    };

    // ===== Apply / reset filters =====
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        // searchBy/category/lowStock تُدار عبر الـ dropdowns (ليست حقول نموذج)،
        // فنحدّث نص البحث والسعر فقط ونحافظ على الباقي.
        setFilters(f => ({
            ...f,
            search: (fd.get('search') as string) || '',
            minPrice: (fd.get('minPrice') as string) || '',
            maxPrice: (fd.get('maxPrice') as string) || '',
        }));
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

    // ===== Columns per tab =====
    const imageColumn: Column = {
        key: 'image',
        label: language === 'ar' ? 'صورة' : 'Image',
        type: 'image',
        render: (_: any, row: any) => (
            <div className="flex justify-center">
                <Image
                    src={row.image || '/assets/images/product.svg'}
                    alt={row.name || 'product'}
                    width={30}
                    height={30}
                    className={`rounded object-cover ${row.image ? '' : 'opacity-70'}`}
                />
            </div>
        ),
        className: 'text-center'
    };

    const productColumns: Column[] = [
        imageColumn,
        { key: 'product_id', label: t('productCode'), type: 'text' },
        { key: 'name', label: t('productName'), type: 'text' },
        { key: 'category', label: t('category'), type: 'text' },
        { key: 'sell_price', label: t('sellPrice'), type: 'currency' },
        { key: 'cost_price', label: t('costPrice'), type: 'currency' },
        { key: 'stock_quantity', label: t('quantity'), type: 'number' },
        { key: 'unit', label: t('unit'), type: 'text' },
    ];

    const serviceColumns: Column[] = [
        { key: 'service_id', label: language === 'ar' ? 'الكود' : 'Code', type: 'text' },
        { key: 'name', label: language === 'ar' ? 'الاسم' : 'Name', type: 'text' },
        { key: 'category', label: language === 'ar' ? 'الفئة' : 'Category', type: 'text' },
        { key: 'sell_price', label: language === 'ar' ? 'سعر البيع' : 'Sell Price', type: 'currency' },
        { key: 'cost_price', label: language === 'ar' ? 'التكلفة' : 'Cost', type: 'currency' },
        { key: 'unit', label: language === 'ar' ? 'الوحدة' : 'Unit', type: 'text' },
        { key: 'estimated_hours', label: language === 'ar' ? 'ساعات مقدرة' : 'Est. Hours', type: 'number' },
        { key: 'assigned_department', label: language === 'ar' ? 'القسم' : 'Department', type: 'text' },
    ];

    const columns = activeTab === 'products' ? productColumns : serviceColumns;

    // ===== Loading / Error =====
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

    const tabLabel = (tab: TabKey) =>
        tab === 'products'
            ? (language === 'ar' ? 'المنتجات' : 'Products')
            : (language === 'ar' ? 'الخدمات' : 'Services');

    return (
        <div
            className="min-h-screen"
            style={{ backgroundImage: "url('/assets/images/BG.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
            <div className="p-3 md:p-5">
                <div className="bg-black/20 backdrop-blur-md p-3 md:p-5 rounded-3xl shadow-2xl border border-white/10">
                    {/* ===== Tabs ===== */}
                    <div className="mb-4 flex items-center gap-2">
                        {(['products', 'services'] as TabKey[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => switchTab(tab)}
                                className={`px-4 py-1.5 rounded-full text-sm font-alata transition-all ${activeTab === tab
                                    ? 'bg-gold text-black shadow-lg shadow-gold/20'
                                    : 'bg-white/5 text-silver hover:text-gold hover:bg-gold/10 border border-gold/20'
                                    }`}
                            >
                                {tabLabel(tab)}
                            </button>
                        ))}
                        <span className="ms-auto text-silver/70 text-xs">
                            {data.length} {language === 'ar' ? 'عنصر' : 'items'}
                        </span>
                    </div>

                    {/* ===== Search bar ===== */}
                    <form onSubmit={handleSubmit} className="mb-4 w-full" style={{ position: 'relative', zIndex: 50 }}>
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
                                        placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
                                        onChange={e => searchItems(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Escape' || e.key === 'Enter') setShowAutocomplete(false); }}
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
                                                    key={item[idColumn]}
                                                    onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(item); }}
                                                    className="px-3 py-2 flex items-center justify-between border-b border-silver/10 last:border-0 hover:bg-gold/20 cursor-pointer transition-colors"
                                                >
                                                    <span className="text-white text-xs">{item.name}</span>
                                                    <span className="text-gold text-[10px] opacity-60">#{item[idColumn]}</span>
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

                                {/* Category */}
                                <CategoryDropdown
                                    categories={uniqueCategories}
                                    selectedCategory={filters.category}
                                    onSelectCategory={(cat) => setFilters(f => ({ ...f, category: cat }))}
                                    language={language}
                                />

                                {/* lowStock (products only) */}
                                {activeTab === 'products' && (
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
                                )}

                                {/* price range */}
                                <div className="flex items-center gap-0.5 bg-[#0a0a0c] border border-silver/30 rounded-full px-1.5 py-1">
                                    <span className="text-silver text-[9px]">$</span>
                                    <input type="number" name="minPrice" defaultValue={filters.minPrice} placeholder="0"
                                        className="w-9 bg-transparent text-white text-[9px] focus:outline-none" />
                                    <span className="text-silver text-[9px]">-</span>
                                    <input type="number" name="maxPrice" defaultValue={filters.maxPrice} placeholder="0"
                                        className="w-9 bg-transparent text-white text-[9px] focus:outline-none" />
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

                                {/* Add + Deleted (products only) */}
                                {activeTab === 'products' && (
                                    <>
                                        <button type="button" onClick={handleAdd} title={t('add')}
                                            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gold/20 transition-colors flex-shrink-0">
                                            <Image src="/assets/images/add.png" alt={t('add')} width={20} height={20} className="w-5 h-5 object-contain" />
                                        </button>
                                        <button type="button" onClick={() => router.push(`/${locale}/products/deleted`)} title={t('deletedProducts')}
                                            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500/20 transition-colors flex-shrink-0">
                                            <Image src="/assets/images/delete.svg" alt={t('deletedProducts')} width={20} height={20} className="w-5 h-5 object-contain" />
                                        </button>
                                    </>
                                )}

                                {/* Add + Deleted services (services tab) */}
                                {activeTab === 'services' && (
                                    <>
                                        <button type="button" onClick={handleAdd} title={t('add')}
                                            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gold/20 transition-colors flex-shrink-0">
                                            <Image src="/assets/images/add.png" alt={t('add')} width={20} height={20} className="w-5 h-5 object-contain" />
                                        </button>
                                        <button type="button" onClick={() => router.push(`/${locale}/services/deleted`)}
                                            title={language === 'ar' ? 'الخدمات المحذوفة' : 'Deleted services'}
                                            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500/20 transition-colors flex-shrink-0">
                                            <Image src="/assets/images/delete.svg" alt={language === 'ar' ? 'الخدمات المحذوفة' : 'Deleted services'} width={20} height={20} className="w-5 h-5 object-contain" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </form>

                    {/* ===== Table ===== */}
                    <DataTable
                        tableName={activeTab}
                        columns={columns}
                        data={paginatedData}
                        onEdit={handleEdit}
                        onDelete={(id: string) => softDelete(id, idColumn)}
                        idColumn={idColumn}
                        language={language}
                        loading={loading}
                        maxHeight="calc(100dvh - 300px)"
                        minWidth={activeTab === 'products' ? '820px' : '860px'}
                    />

                    {/* ===== Pagination ===== */}
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

            {activeTab === 'products' && (
                <ProductModal
                    isOpen={isModalOpen} onClose={handleClose} onSuccess={handleSuccess}
                    product={editingProduct} language={language}
                />
            )}
            {activeTab === 'services' && (
                <ServiceModal
                    isOpen={isModalOpen} onClose={handleClose} onSuccess={handleSuccess}
                    service={editingProduct} language={language}
                />
            )}
        </div>
    );
}
