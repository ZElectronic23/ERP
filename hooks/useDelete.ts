// hooks/useDelete.ts
import { supabase } from '@/lib/supabaseClient'
import { useState } from 'react'

export function useDelete(tableName: string, onSuccess?: () => void) {
    const [loading, setLoading] = useState(false)

    const softDelete = async (id: string, idColumn: string = 'id') => {
        setLoading(true)
        const { error } = await supabase
            .from(tableName)
            .update({ deleted_at: new Date().toISOString() })
            .eq(idColumn, id)

        if (!error && onSuccess) onSuccess()
        setLoading(false)
        return { error }
    }

    const restore = async (id: string, idColumn: string = 'id') => {
        setLoading(true)
        const { error } = await supabase
            .from(tableName)
            .update({ deleted_at: null })
            .eq(idColumn, id)

        if (!error && onSuccess) onSuccess()
        setLoading(false)
        return { error }
    }

    return { softDelete, restore, loading }
}