import { supabase } from '@/lib/supabaseClient'
import { useEffect, useState, useCallback } from 'react'

interface UseTableDataReturn {
    data: any[]
    loading: boolean
    error: Error | null
    totalCount: number
    refresh: () => void
}

export function useTableData(tableName: string, searchParams: any): UseTableDataReturn {
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

            try {
                let query = supabase
                    .from(tableName)
                    .select('*', { count: 'exact' })
                    .is('deleted_at', null)

                // البحث بالاسم
                if (searchParams.search) {
                    query = query.ilike('name', `%${searchParams.search}%`)
                }

                // البحث بالكود
                if (searchParams.code) {
                    query = query.ilike('product_id', `%${searchParams.code}%`)
                }

                // فلاتر الفئة
                if (searchParams.filters?.category) {
                    query = query.eq('category', searchParams.filters.category)
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

                // فلتر المخزون الناقص
                if (searchParams.lowStock) {
                    query = query.lt('stock_quantity', searchParams.lowStock)
                }

                // ترتيب النتائج
                const orderBy = searchParams.orderBy || 'product_id'
                const orderDirection = searchParams.orderDirection || 'asc'

                const { data, error, count } = await query
                    .order(orderBy, { ascending: orderDirection === 'asc' })

                if (error) throw new Error(error.message)

                if (isMounted) {
                    setData(data || [])
                    setTotalCount(count || 0)
                    setError(null)
                }
            } catch (err) {
                if (isMounted) {
                    setError(err as Error)
                    setData([])
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
    }, [tableName, JSON.stringify(searchParams), refreshKey])

    return { data, loading, error, totalCount, refresh }
}