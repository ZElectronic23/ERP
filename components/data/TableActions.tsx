'use client';

import { useState } from 'react'

interface TableActionsProps {
    onEdit: () => void;
    onDelete: () => void;
    onRestore?: () => void;
    showRestore?: boolean;
    language: 'ar' | 'en';
}

export default function TableActions({
    onEdit,
    onDelete,
    onRestore,
    showRestore = false,
    language
}: TableActionsProps) {
    const [confirming, setConfirming] = useState(false)

    if (confirming) {
        return (
            <div className="flex items-center gap-1">
                <button
                    onClick={() => {
                        if (showRestore && onRestore) {
                            onRestore()
                        } else {
                            onDelete()
                        }
                        setConfirming(false)
                    }}
                    className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500 hover:text-white transition-colors"
                >
                    {language === 'ar' ? 'تأكيد' : 'Confirm'}
                </button>
                <button
                    onClick={() => setConfirming(false)}
                    className="text-xs px-2 py-1 bg-silver/20 text-silver rounded hover:bg-silver/40 transition-colors"
                >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={onEdit}
                className="p-1 text-gold hover:bg-gold/20 rounded transition-colors"
                title={language === 'ar' ? 'تعديل' : 'Edit'}
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                </svg>
            </button>

            {showRestore ? (
                <button
                    onClick={() => setConfirming(true)}
                    className="p-1 text-green-500 hover:bg-green-500/20 rounded transition-colors"
                    title={language === 'ar' ? 'استعادة' : 'Restore'}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                </button>
            ) : (
                <button
                    onClick={() => setConfirming(true)}
                    className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                    title={language === 'ar' ? 'حذف' : 'Delete'}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                </button>
            )}
        </div>
    )
}