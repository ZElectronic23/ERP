'use client';

import TableActions from './TableActions'
import { Column } from '@/config/tables'
import { translations, Language } from '@/lib/translations'

interface DataTableProps {
    tableName: string
    columns: Column[]
    data: any[]
    onEdit: (item: any) => void
    onDelete: (id: string) => void
    onRestore?: (id: string) => void
    showDeleted?: boolean
    idColumn?: string
    language?: Language
}

export default function DataTable({
    columns,
    data,
    onEdit,
    onDelete,
    onRestore,
    showDeleted = false,
    idColumn = 'product_id',
    language = 'ar'
}: DataTableProps) {

    const t = translations[language]

    // ترجمة أسماء الأعمدة
    const getColumnLabel = (key: string): string => {
        const translationMap: Record<string, string> = {
            'product_id': t.productCode,
            'name': t.productName,
            'category': t.category,
            'sell_price': t.sellPrice,
            'cost_price': t.costPrice,
            'stock_quantity': t.quantity,
            'unit': t.unit
        }
        return translationMap[key] || key
    }

    function renderCell(value: any, type: string) {
        if (value === null || value === undefined) return <span className="text-silver/60 text-[12px]">—</span>

        switch (type) {
            case 'currency':
                return <span className="text-white text-[12px] font-medium">{Number(value).toFixed(2)} ج.م</span>
            case 'date':
                return <span className="text-silver text-[12px]">{new Date(value).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</span>
            case 'boolean':
                return (
                    <span className="px-2 py-1 rounded-full text-xs bg-gold/20 text-gold font-medium">
                        {value ? 'نعم' : 'لا'}
                    </span>
                )
            case 'number':
                return <span className="text-white text-[12px] font-medium">{Number(value).toLocaleString()}</span>
            default:
                return <span className="text-white text-[12px]">{String(value)}</span>
        }
    }

    return (
        <div className="bg-[#1a1a1e]/50 backdrop-blur-sm rounded-xl border border-silver/20 shadow-xl">
            <table className="w-full min-w-[800px]">
                <thead className="bg-gradient-to-b from-[#2a2a2e] to-[#1a1a1e] border-b-2 border-gold/30 sticky top-0 z-20">
                    <tr className="text-[12px]">
                        {columns.map((col) => (
                            <th key={col.key} className="p-2 text-right font-alata font-bold text-gold tracking-wide">
                                {getColumnLabel(col.key)}
                            </th>
                        ))}
                        <th className="p-2 text-center font-alata font-bold text-gold tracking-wide">
                            {t.edit}
                        </th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-silver/10">
                    {data.map((item, index) => (
                        <tr
                            key={item[idColumn] || index}
                            className="hover:bg-gold/40 transition-colors duration-200"
                        >
                            {columns.map((col) => (
                                <td key={col.key} className="p-2">
                                    {renderCell(item[col.key], col.type)}
                                </td>
                            ))}
                            <td className="p-2">
                                <TableActions
                                    item={item}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onRestore={onRestore}
                                    showDeleted={showDeleted}
                                    idColumn={idColumn}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {data.length === 0 && (
                <div className="p-12 text-center">
                    <span className="material-icons text-5xl text-silver/20 mb-3">inventory</span>
                    <p className="text-silver/60 text-[12px]">{t.noData}</p>
                </div>
            )}
        </div>
    )
}
