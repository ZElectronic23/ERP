// hooks/useTableData.ts

import { supabase } from '@/lib/supabaseClient'
import { useEffect, useState, useCallback } from 'react'

export interface SearchParams {
    search?: string;
    searchBy?: 'name' | 'code' | 'email';
    code?: string;
    filters?: {
        category?: string;
        status?: string;
        role_key?: string;
        entity_type?: string;
    };
    priceRange?: {
        min?: string;
        max?: string;
    };
    lowStock?: number | null;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    // إزالة page و limit لجلب كل البيانات
}

export interface UseTableDataReturn {
    data: any[];
    loading: boolean;
    error: Error | null;
    totalCount: number;
    refresh: () => void;
}

export function useTableData(
    tableName: string,
    searchParams: SearchParams = {}
): UseTableDataReturn {
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)
    const [totalCount, setTotalCount] = useState(0)
    const [refreshKey, setRefreshKey] = useState(0)

    const refresh = useCallback(() => {
        setRefreshKey(prev => prev + 1)
    }, [])

    useEffect(() => {
        let isMounted = true

        async function fetchData() {
            if (!isMounted) return

            setLoading(true)
            setError(null)

            try {
                let query = supabase
                    .from(tableName)
                    .select('*', { count: 'exact' })
                    .is('deleted_at', null)

                // البحث بالاسم
                if (searchParams.search && searchParams.searchBy === 'name') {
                    query = query.ilike('name', `%${searchParams.search}%`)
                }

                // البحث بالكود
                if (searchParams.code || (searchParams.search && searchParams.searchBy === 'code')) {
                    const searchCode = searchParams.code || searchParams.search;
                    query = query.ilike('product_id', `%${searchCode}%`)
                }

                // البحث بالبريد الإلكتروني
                if (searchParams.search && searchParams.searchBy === 'email') {
                    query = query.ilike('email', `%${searchParams.search}%`)
                }

                // فلاتر الفئة
                if (searchParams.filters?.category) {
                    query = query.eq('category', searchParams.filters.category)
                }

                // فلتر الحالة
                if (searchParams.filters?.status) {
                    query = query.eq('status', searchParams.filters.status)
                }

                // فلتر الدور
                if (searchParams.filters?.role_key) {
                    query = query.eq('role_key', searchParams.filters.role_key)
                }

                // فلتر النوع
                if (searchParams.filters?.entity_type) {
                    query = query.eq('entity_type', searchParams.filters.entity_type)
                }

                // فلتر السعر (من - إلى)
                if (searchParams.priceRange?.min) {
                    const minVal = parseFloat(searchParams.priceRange.min)
                    if (!isNaN(minVal)) {
                        query = query.gte('sell_price', minVal)
                    }
                }

                if (searchParams.priceRange?.max) {
                    const maxVal = parseFloat(searchParams.priceRange.max)
                    if (!isNaN(maxVal)) {
                        query = query.lte('sell_price', maxVal)
                    }
                }

                // فلتر المخزون المنخفض
                if (searchParams.lowStock) {
                    query = query.lt('stock_quantity', searchParams.lowStock)
                }

                // الترتيب
                const orderBy = searchParams.orderBy || 'created_at'
                const orderDirection = searchParams.orderDirection || 'desc'
                query = query.order(orderBy, { ascending: orderDirection === 'asc' })

                // لا نستخدم range - نجلب كل البيانات دفعة واحدة
                const { data: fetchedData, error: fetchError, count } = await query

                if (fetchError) {
                    throw new Error(fetchError.message)
                }

                if (isMounted) {
                    setData(fetchedData || [])
                    setTotalCount(count || 0)
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err)
                    console.error('Error fetching data:', err)
                }
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        fetchData()

        return () => {
            isMounted = false
        }
    }, [
        tableName,
        searchParams.search,
        searchParams.searchBy,
        searchParams.code,
        searchParams.filters?.category,
        searchParams.filters?.status,
        searchParams.filters?.role_key,
        searchParams.filters?.entity_type,
        searchParams.priceRange?.min,
        searchParams.priceRange?.max,
        searchParams.lowStock,
        searchParams.orderBy,
        searchParams.orderDirection,
        refreshKey,
    ])

    return {
        data,
        loading,
        error,
        totalCount,
        refresh,
    }
}