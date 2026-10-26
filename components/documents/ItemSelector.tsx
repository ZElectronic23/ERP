'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { LineItem } from '@/lib/documents';
import { formatCurrency } from '@/lib/documents';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface CatalogItem {
  id: string;
  item_type: 'product' | 'service';
  name: string;
  unit: string;
  category: string;
  cost_price: number;
  sell_price: number;
  floor_price: number;
  target_price: number;
  direct_cost: number;
  loaded_cost: number;
  max_discount_pct: number;
}

interface ItemSelectorProps {
  onAddItem: (item: LineItem) => void;
  locale: string;
}

type TabFilter = 'all' | 'product' | 'service' | 'custom';

// ═══════════════════════════════════════════════════════════════
// Labels
// ═══════════════════════════════════════════════════════════════

const labels = {
  ar: {
    searchPlaceholder: 'ابحث عن منتج أو خدمة...',
    all: 'الكل',
    products: 'منتجات',
    services: 'خدمات',
    custom: 'بند مخصص',
    addItem: 'إضافة بند',
    noResults: 'لا توجد نتائج',
    loading: 'جاري البحث...',
    itemName: 'اسم البند',
    unit: 'الوحدة',
    unitPrice: 'سعر الوحدة',
    quantity: 'الكمية',
    add: 'إضافة',
    cancel: 'إلغاء',
    targetPrice: 'السعر المستهدف',
    floorPrice: 'أقل سعر',
    category: 'الفئة',
    typeProduct: 'منتج',
    typeService: 'خدمة',
  },
  en: {
    searchPlaceholder: 'Search products or services...',
    all: 'All',
    products: 'Products',
    services: 'Services',
    custom: 'Custom Item',
    addItem: 'Add Item',
    noResults: 'No results found',
    loading: 'Searching...',
    itemName: 'Item Name',
    unit: 'Unit',
    unitPrice: 'Unit Price',
    quantity: 'Quantity',
    add: 'Add',
    cancel: 'Cancel',
    targetPrice: 'Target Price',
    floorPrice: 'Floor Price',
    category: 'Category',
    typeProduct: 'Product',
    typeService: 'Service',
  },
};

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export default function ItemSelector({ onAddItem, locale }: ItemSelectorProps) {
  const t = locale === 'ar' ? labels.ar : labels.en;
  const isRtl = locale === 'ar';

  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Custom item form
  const [customName, setCustomName] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');

  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced search
  const doSearch = useCallback(
    async (query: string, type: TabFilter) => {
      if (type === 'custom') return;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('search', query.trim());
        params.set('type', type === 'all' ? 'all' : type);
        params.set('limit', '30');

        const res = await fetch(`/api/documents/items?${params}`);
        const data = await res.json();
        setResults(data.items || []);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activeTab === 'custom') {
      setShowDropdown(false);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(search, activeTab), 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, activeTab, doSearch]);

  // Add catalog item
  function handleSelectItem(item: CatalogItem) {
    const lineItem: LineItem = {
      id: crypto.randomUUID(),
      sortOrder: 0,
      itemType: item.item_type,
      itemId: item.id,
      itemName: item.name,
      itemUnit: item.unit,
      category: item.category,
      quantity: 1,
      unitPrice: item.target_price,
      floorPrice: item.floor_price,
      targetPrice: item.target_price,
      discountPct: 0,
      discountAmount: 0,
      lineTotal: item.target_price,
    };
    onAddItem(lineItem);
    setSearch('');
    setShowDropdown(false);
  }

  // Add custom item
  function handleAddCustom() {
    const price = parseFloat(customPrice);
    const qty = parseFloat(customQty) || 1;
    if (!customName.trim() || isNaN(price) || price <= 0) return;

    const lineItem: LineItem = {
      id: crypto.randomUUID(),
      sortOrder: 0,
      itemType: 'custom',
      itemId: null,
      itemName: customName.trim(),
      itemUnit: customUnit.trim() || (locale === 'ar' ? 'وحدة' : 'unit'),
      category: '',
      quantity: qty,
      unitPrice: price,
      floorPrice: 0,
      targetPrice: price,
      discountPct: 0,
      discountAmount: 0,
      lineTotal: price * qty,
    };
    onAddItem(lineItem);
    setCustomName('');
    setCustomUnit('');
    setCustomPrice('');
    setCustomQty('1');
  }

  // ─── Tabs ────────────────────────────────────────────────
  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'all', label: t.all },
    { key: 'product', label: t.products },
    { key: 'service', label: t.services },
    { key: 'custom', label: t.custom },
  ];

  return (
    <div ref={containerRef} className="relative" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Tab bar */}
      <div className="flex gap-1 mb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-[#DBA935] text-[#3E3B3F]'
                : 'bg-white/5 text-[#C0C0C0] hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search input (catalog mode) */}
      {activeTab !== 'custom' && (
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setShowDropdown(true);
              else doSearch(search, activeTab);
            }}
            placeholder={t.searchPlaceholder}
            className="w-full px-4 py-2.5 bg-white/5 backdrop-blur-sm border border-[#DBA935]/20 rounded-xl text-white placeholder:text-[#C0C0C0]/50 focus:outline-none focus:border-[#DBA935]/50 text-sm"
          />
          {loading && (
            <div className="absolute top-1/2 -translate-y-1/2 end-3">
              <div className="w-4 h-4 border-2 border-[#DBA935]/30 border-t-[#DBA935] rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Dropdown results */}
      {showDropdown && activeTab !== 'custom' && (
        <div className="absolute z-50 w-full mt-1 max-h-72 overflow-y-auto bg-[#2a2829] border border-[#DBA935]/20 rounded-xl shadow-2xl">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[#C0C0C0]/60 text-sm">
              {loading ? t.loading : t.noResults}
            </div>
          ) : (
            results.map((item) => (
              <button
                key={`${item.item_type}-${item.id}`}
                onClick={() => handleSelectItem(item)}
                className="w-full text-start px-4 py-2.5 hover:bg-[#DBA935]/10 transition-colors border-b border-white/5 last:border-b-0 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`shrink-0 text-[0.6rem] px-1.5 py-0.5 rounded font-medium ${
                          item.item_type === 'product'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {item.item_type === 'product' ? t.typeProduct : t.typeService}
                      </span>
                      <span className="text-sm text-white truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[0.65rem] text-[#C0C0C0]/60">{item.category}</span>
                      <span className="text-[0.65rem] text-[#C0C0C0]/40">|</span>
                      <span className="text-[0.65rem] text-[#C0C0C0]/60">{item.unit}</span>
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <div className="text-sm font-medium text-[#DBA935]">
                      {formatCurrency(item.target_price, locale)}
                    </div>
                    <div className="text-[0.6rem] text-[#C0C0C0]/40">
                      {t.floorPrice}: {formatCurrency(item.floor_price, locale)}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Custom item form */}
      {activeTab === 'custom' && (
        <div className="bg-white/5 backdrop-blur-sm border border-[#DBA935]/20 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#C0C0C0]/70 mb-1">{t.itemName} *</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#DBA935]/50"
              />
            </div>
            <div>
              <label className="block text-xs text-[#C0C0C0]/70 mb-1">{t.unit}</label>
              <input
                type="text"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                placeholder={locale === 'ar' ? 'وحدة' : 'unit'}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#DBA935]/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#C0C0C0]/70 mb-1">{t.unitPrice} *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#DBA935]/50"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs text-[#C0C0C0]/70 mb-1">{t.quantity}</label>
              <input
                type="number"
                min="1"
                step="1"
                value={customQty}
                onChange={(e) => setCustomQty(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#DBA935]/50"
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleAddCustom}
              disabled={!customName.trim() || !customPrice || parseFloat(customPrice) <= 0}
              className="px-4 py-2 bg-[#DBA935] text-[#3E3B3F] rounded-lg text-sm font-medium hover:bg-[#DBA935]/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.add}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
