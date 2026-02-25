// config/tables.ts
export type ColumnType = 'text' | 'number' | 'currency' | 'date' | 'boolean';

export interface Column {
    key: string;
    label: string;
    type: ColumnType;
    searchable?: boolean;
    filterable?: boolean;
}

export interface TableConfig {
    name: string;
    columns: Column[];
    formFields: any[]; // هنحدده بعدين
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
        formFields: [
            { name: 'product_id', label: 'كود المنتج', type: 'text', required: true },
            { name: 'name', label: 'اسم المنتج', type: 'text', required: true },
            { name: 'category', label: 'الفئة', type: 'text' },
            { name: 'sell_price', label: 'سعر البيع', type: 'number' },
            { name: 'cost_price', label: 'سعر التكلفة', type: 'number' },
            { name: 'stock_quantity', label: 'الكمية', type: 'number' },
            { name: 'unit', label: 'الوحدة', type: 'text' },
        ],
    },
};