// config/tables.ts
export type ColumnType = 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'image';

export interface Column {
    key: string;
    label: string;
    type: ColumnType;
    render?: (value: any, row: any) => React.ReactNode;
    className?: string;
    searchable?: boolean;
    filterable?: boolean;
}

export interface TableConfig {
    name: string;
    columns: Column[];
    formFields: any[];
}

export const tableConfigs: Record<string, TableConfig> = {
    products: {
        name: 'المنتجات',
        columns: [
            { key: 'product_id', label: 'الكود', type: 'text' },
            { key: 'name', label: 'الاسم', type: 'text', searchable: true },
            { key: 'category', label: 'الفئة', type: 'text', filterable: true },
            { key: 'sell_price', label: 'سعر البيع', type: 'currency' },
            { key: 'cost_price', label: 'التكلفة', type: 'currency' },
            { key: 'stock_quantity', label: 'الكمية', type: 'number' },
            { key: 'unit', label: 'الوحدة', type: 'text' },
        ],
        formFields: [],
    },
};