// hooks/useDelete.ts

import { supabase } from '@/lib/supabaseClient'
import { useState, useCallback } from 'react'

export interface UseDeleteReturn {
    softDelete: (id: string, idColumn?: string) => Promise<{ success: boolean; error?: string }>;
    hardDelete: (id: string, idColumn?: string) => Promise<{ success: boolean; error?: string }>;
    restore: (id: string, idColumn?: string) => Promise<{ success: boolean; error?: string }>;
    loading: boolean;
    error: string | null;
}

export function useDelete(
    tableName: string, 
    onSuccess?: () => void
): UseDeleteReturn {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const softDelete = useCallback(async (
        id: string, 
        idColumn: string = 'id'
    ): Promise<{ success: boolean; error?: string }> => {
        setLoading(true)
        setError(null)

        try {
            const { error: deleteError } = await supabase
                .from(tableName)
                .update({ deleted_at: new Date().toISOString() })
                .eq(idColumn, id)

            if (deleteError) {
                setError(deleteError.message)
                return { success: false, error: deleteError.message }
            }

            if (onSuccess) onSuccess()
            return { success: true }
        } catch (err: any) {
            const errorMessage = err.message || 'حدث خطأ أثناء الحذف'
            setError(errorMessage)
            return { success: false, error: errorMessage }
        } finally {
            setLoading(false)
        }
    }, [tableName, onSuccess])

    const hardDelete = useCallback(async (
        id: string, 
        idColumn: string = 'id'
    ): Promise<{ success: boolean; error?: string }> => {
        setLoading(true)
        setError(null)

        try {
            const { error: deleteError } = await supabase
                .from(tableName)
                .delete()
                .eq(idColumn, id)

            if (deleteError) {
                setError(deleteError.message)
                return { success: false, error: deleteError.message }
            }

            if (onSuccess) onSuccess()
            return { success: true }
        } catch (err: any) {
            const errorMessage = err.message || 'حدث خطأ أثناء الحذف النهائي'
            setError(errorMessage)
            return { success: false, error: errorMessage }
        } finally {
            setLoading(false)
        }
    }, [tableName, onSuccess])

    const restore = useCallback(async (
        id: string, 
        idColumn: string = 'id'
    ): Promise<{ success: boolean; error?: string }> => {
        setLoading(true)
        setError(null)

        try {
            const { error: restoreError } = await supabase
                .from(tableName)
                .update({ deleted_at: null })
                .eq(idColumn, id)

            if (restoreError) {
                setError(restoreError.message)
                return { success: false, error: restoreError.message }
            }

            if (onSuccess) onSuccess()
            return { success: true }
        } catch (err: any) {
            const errorMessage = err.message || 'حدث خطأ أثناء الاستعادة'
            setError(errorMessage)
            return { success: false, error: errorMessage }
        } finally {
            setLoading(false)
        }
    }, [tableName, onSuccess])

    return { softDelete, hardDelete, restore, loading, error }
}
