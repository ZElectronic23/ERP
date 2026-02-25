// components/data/SearchFilter.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

interface FilterOption {
    key: string
    label: string
    options: string[]
}

interface SearchFilterProps {
    searchPlaceholder?: string
    filters?: FilterOption[]
}

export default function SearchFilter({
    searchPlaceholder = 'بحث...',
    filters = []
}: SearchFilterProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});

    useEffect(() => {
        // تجميع قيم الفلاتر من URL
        const initialFilters: Record<string, string> = {};
        filters.forEach(f => {
            const value = searchParams.get(f.key);
            if (value) initialFilters[f.key] = value;
        });
        setFilterValues(initialFilters);
    }, []);

    useEffect(() => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);

        filters.forEach(f => {
            if (filterValues[f.key]) params.set(f.key, filterValues[f.key]);
        });

        const timeout = setTimeout(() => {
            router.push(`?${params.toString()}`);
        }, 500);

        return () => clearTimeout(timeout);
    }, [search, filterValues, router]);

    const clearFilters = () => {
        setSearch('');
        const cleared: Record<string, string> = {};
        filters.forEach(f => cleared[f.key] = '');
        setFilterValues(cleared);
        router.push('?');
    };

    const hasFilters = search || Object.values(filterValues).some(v => v);

    return (
        <div className="flex gap-2 w-full">
            <div className="relative flex-1">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-silver">
                    <span className="material-icons text-base">search</span>
                </span>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full pr-10 pl-3 py-2 bg-darkwhite/80 border border-silver/20 rounded-lg text-white placeholder-silver/50 focus:outline-none focus:border-gold"
                />
            </div>

            {filters.map((filter) => (
                <select
                    key={filter.key}
                    value={filterValues[filter.key] || ''}
                    onChange={(e) => setFilterValues(prev => ({ ...prev, [filter.key]: e.target.value }))}
                    className="px-3 py-2 bg-darkwhite/80 border border-silver/20 rounded-lg text-white focus:outline-none focus:border-gold min-w-[120px]"
                >
                    <option value="">{filter.label}</option>
                    {filter.options.map((opt) => (
                        <option key={opt} value={opt} className="bg-darkwhite">
                            {opt}
                        </option>
                    ))}
                </select>
            ))}

            {hasFilters && (
                <button
                    onClick={clearFilters}
                    className="px-3 py-2 bg-silver/20 rounded-lg text-white hover:bg-gold hover:text-darkwhite transition"
                    title="مسح الفلاتر"
                >
                    <span className="material-icons text-base">close</span>
                </button>
            )}
        </div>
    );
}