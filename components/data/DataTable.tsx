'use client';

import { RefObject } from 'react';
import TableActions from './TableActions';
import { Column } from '@/config/tables';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

interface DataTableProps {
    tableName: string;
    columns: Column[];
    data: any[];
    onEdit?: (item: any) => void;       // ✅ اختياري
    onDelete?: (id: string) => void;     // ✅ اختياري
    onRestore?: (id: string) => void;
    showDeleted?: boolean;
    idColumn?: string;
    language?: 'ar' | 'en';
    tableHeaderRef?: RefObject<HTMLTableSectionElement | null>;
    loading?: boolean;
}

export default function DataTable({
    columns,
    data,
    onEdit,
    onDelete,
    onRestore,
    showDeleted = false,
    idColumn = 'product_id',
    language = 'ar',
    tableHeaderRef,
    loading = false,
}: DataTableProps) {
    const t = useTranslations();

    // داخل DataTable

    const getColumnLabel = (key: string): string => {
        const translationMap: Record<string, string> = {
            'product_id': t('productCode'),
            'name': t('productName'),
            'category': t('category'),
            'sell_price': t('sellPrice'),
            'cost_price': t('costPrice'),
            'stock_quantity': t('quantity'),
            'unit': t('unit'),
            'email': t('email'),
            'full_name': t('fullName'),
            'phone': t('phone'),
            'role_key': t('role'),
            'is_admin': t('admin'),
            'entity_type': t('type'),
            'status': t('status'),
            'image': t('image'),
            'profile_image': t('image'),
        };
        return translationMap[key] || key;
    };

    function renderCell(value: any, type: string, row: any) {
        if (value === null || value === undefined) {
            return <span className="text-silver/60">—</span>;
        }

        switch (type) {
            case 'currency':
                return (
                    <span className="text-white font-medium">
                        {Number(value).toFixed(2)} ج.م
                    </span>
                );
            case 'date':
                return (
                    <span className="text-silver">
                        {new Date(value).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                    </span>
                );
            case 'boolean':
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${value
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                        }`}>
                        {value ? (language === 'ar' ? 'نعم' : 'Yes') : (language === 'ar' ? 'لا' : 'No')}
                    </span>
                );
            case 'status':
                return renderStatus(value);
            case 'image':
                return renderImage(value);
            case 'number':
                return <span className="text-white">{Number(value).toLocaleString()}</span>;
            default:
                return <span className="text-white">{String(value)}</span>;
        }
    }

    function renderStatus(status: string) {
        const statusClasses: Record<string, string> = {
            active: 'bg-green-500/20 text-green-400',
            inactive: 'bg-yellow-500/20 text-yellow-400',
            deleted: 'bg-red-500/20 text-red-400',
            pending: 'bg-blue-500/20 text-blue-400',
        };

        const statusLabels: Record<string, string> = {
            active: t('active'),
            inactive: t('inactive'),
            deleted: t('deleted'),
            pending: language === 'ar' ? 'معلق' : 'Pending',
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[status] || 'bg-gray-500/20 text-gray-400'
                }`}>
                {statusLabels[status] || status}
            </span>
        );
    }

    function renderImage(imageUrl: string | null) {
        if (!imageUrl) {
            return (
                <div className="w-10 h-10 rounded-lg bg-[#3E3B3F] flex items-center justify-center">
                    <svg className="w-5 h-5 text-silver/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
            );
        }

        return (
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#3E3B3F]">
                <Image
                    src={imageUrl}
                    alt="Product"
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="w-full overflow-x-auto">
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#DBA935]"></div>
                    <span className="mr-3 text-silver">{t('loading')}</span>
                </div>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="w-full overflow-x-auto">
                <div className="flex flex-col items-center justify-center py-12 text-silver/60">
                    <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p>{t('noData')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full overflow-x-auto">
            <table className="w-full">
                <thead ref={tableHeaderRef} className="bg-[#2a2a2a]">
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className={`px-2 py-2 text-right text-xs font-medium text-silver border-b border-[#3E3B3F] break-words whitespace-normal ${col.className || ''
                                    }`}
                                style={{ maxWidth: '150px' }}
                            >
                                {getColumnLabel(col.key)}
                            </th>
                        ))}
                        {(onEdit || onDelete || onRestore) && (
                            <th className="px-2 py-2 text-right text-xs font-medium text-silver border-b border-[#3E3B3F] break-words whitespace-normal" style={{ maxWidth: '100px' }}>
                                {t('actions')}
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#3E3B3F]">
                    {data.map((row, index) => (
                        <tr
                            key={row[idColumn] || index}
                            className="hover:bg-[#2a2a2a]/50 transition-colors"
                        >
                            {columns.map((col) => (
                                <td
                                    key={col.key}
                                    className={`px-2 py-2 text-sm ${col.className || ''}`}
                                >
                                    {col.render
                                        ? col.render(row[col.key], row)
                                        : renderCell(row[col.key], col.type, row)
                                    }
                                </td>
                            ))}
                            {(onEdit || onDelete || onRestore) && (
                                <td className="px-2 py-2">
                                    <TableActions
                                        onEdit={() => onEdit?.(row)}
                                        onDelete={() => onDelete?.(row[idColumn])}
                                        onRestore={onRestore ? () => onRestore(row[idColumn]) : undefined}
                                        showRestore={showDeleted && !!row.deleted_at}
                                        language={language}
                                    />
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}