// components/data/TableActions.tsx
'use client';

import { useState } from 'react'

interface TableActionsProps {
    item: any
    onEdit: (item: any) => void
    onDelete: (id: string) => void
    onRestore?: (id: string) => void
    showDeleted?: boolean
    idColumn?: string
}

export default function TableActions({
    item,
    onEdit,
    onDelete,
    onRestore,
    showDeleted = false,
    idColumn = 'product_id'
}: TableActionsProps) {
    const [confirming, setConfirming] = useState(false)
    const id = item[idColumn]

    if (confirming) {
        return (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => {
                        onDelete(id)
                        setConfirming(false)
                    }}
                    className="px-2 py-1 bg-red-500/20 rounded-lg text-red-300 text-xs hover:bg-red-500 hover:text-white transition"
                >
                    تأكيد
                </button>
                <button
                    onClick={() => setConfirming(false)}
                    className="px-2 py-1 bg-silver/20 rounded-lg text-silver text-xs hover:bg-silver/40 transition"
                >
                    إلغاء
                </button>
            </div>
        )
    }

    if (showDeleted && onRestore) {
        return (
            <div className="flex items-center justify-center gap-2">
                <button
                    onClick={() => onRestore(id)}
                    className="p-1.5 bg-green-500/20 rounded-lg text-green-300 hover:bg-green-500 hover:text-white transition"
                    title="استرجاع"
                >
                    <span className="material-icons text-sm">restore</span>
                </button>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-center gap-2">
            <button
                onClick={() => onEdit(item)}
                className="p-1.5 bg-silver/20 rounded-lg text-white hover:bg-gold hover:text-darkwhite transition"
                title="تعديل"
            >
                <span className="material-icons text-sm">edit</span>
            </button>
            <button
                onClick={() => setConfirming(true)}
                className="p-1.5 bg-red-500/20 rounded-lg text-red-300 hover:bg-red-500 hover:text-white transition"
                title="حذف"
            >
                <span className="material-icons text-sm">delete</span>
            </button>
        </div>
    )
}