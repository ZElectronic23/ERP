export const translations = {
    ar: {
        // العناوين الرئيسية
        products: 'المنتجات',
        add: 'جديد',

        // البحث والفلاتر
        search: 'بحث...',
        searchBy: 'بحث بـ',
        byName: 'بالاسم',
        byCode: 'بالكود',
        category: 'الفئة',
        allCategories: 'كل الفئات',
        price: 'السعر',
        from: 'من',
        to: 'إلى',
        stock: 'المخزون',
        all: 'الكل',
        lessThan5: 'أقل من 5',
        lessThan10: 'أقل من 10',
        lessThan20: 'أقل من 20',
        lessThan50: 'أقل من 50',
        clearAll: 'مسح الكل',

        // الحالات
        loading: 'جاري التحميل...',
        noData: 'لا توجد بيانات',

        // أزرار الجدول
        edit: 'الإجراءات',
        delete: 'حذف',
        confirm: 'تأكيد',
        cancel: 'إلغاء',

        // مودال الإضافة/التعديل
        save: 'حفظ',
        addNew: 'إضافة منتج جديد',
        editProduct: 'تعديل المنتج',
        productCode: 'كود المنتج',
        productName: 'اسم المنتج',
        sellPrice: 'سعر البيع',
        costPrice: 'سعر التكلفة',
        quantity: 'الكمية',
        unit: 'الوحدة',
        codeCannotBeEdited: 'لا يمكن تعديل كود المنتج بعد الإنشاء',
        searchForCategory: 'ابحث عن فئة...',

        // أخطاء
        error: 'خطأ',
    },
    en: {
        // Main titles
        products: 'Products',
        add: 'Add',

        // Search and filters
        search: 'Search...',
        searchBy: 'Search by',
        byName: 'By name',
        byCode: 'By code',
        category: 'Category',
        allCategories: 'All categories',
        price: 'Price',
        from: 'From',
        to: 'To',
        stock: 'Stock',
        all: 'All',
        lessThan5: 'Less than 5',
        lessThan10: 'Less than 10',
        lessThan20: 'Less than 20',
        lessThan50: 'Less than 50',
        clearAll: 'Clear all',

        // States
        loading: 'Loading...',
        noData: 'No data available',

        // Table buttons
        edit: 'Actions',
        delete: 'Delete',
        confirm: 'Confirm',
        cancel: 'Cancel',

        // Add/Edit Modal
        save: 'Save',
        addNew: 'Add New Product',
        editProduct: 'Edit Product',
        productCode: 'Product Code',
        productName: 'Product Name',
        sellPrice: 'Sell Price',
        costPrice: 'Cost Price',
        quantity: 'Quantity',
        unit: 'Unit',
        codeCannotBeEdited: 'Product code cannot be edited after creation',
        searchForCategory: 'Search for category...',

        // Errors
        error: 'Error',
    }
}

export type Language = 'ar' | 'en'
export type TranslationKey = keyof typeof translations.ar