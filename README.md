# Z.Electronic ERP System

نظام إدارة الموارد المؤسسية المتكامل - Z.Electronic

## 🎯 نظرة سريعة

- **التقنيات:** Next.js 16, TypeScript, Supabase, Tailwind CSS
- **الهيكل:** Modular Architecture مع فصل كامل للمسؤوليات
- **GitHub:** https://github.com/ZElectronic23/ERP.git

## 📂 هيكل المشروع

```
ERP/
├── app/
│   ├── admin/users/           # صفحة إدارة المستخدمين
│   │   ├── api/               # API routes للمستخدمين
│   │   │   ├── route.ts       # GET, POST, PATCH
│   │   │   ├── delete/        # حذف مستخدم
│   │   │   ├── restore/       # استعادة مستخدم
│   │   │   └── status/        # تغيير حالة
│   │   └── page.tsx           # صفحة المستخدمين
│   ├── products/              # صفحة المنتجات
│   │   └── page.tsx
│   ├── login/                 # صفحة تسجيل الدخول
│   ├── dashboard/             # لوحة التحكم
│   ├── layout.tsx             # Layout رئيسي مع AppProvider
│   └── globals.css            # الأنماط العامة
│
├── components/
│   ├── data/
│   │   ├── DataTable.tsx      # جدول بيانات متكامل
│   │   ├── TableActions.tsx   # أزرار الإجراءات
│   │   ├── SearchFilter.tsx   # فلترة البحث
│   │   └── Pagination.tsx     # تقسيم الصفحات
│   ├── modals/
│   │   └── ProductModal.tsx   # نافذة إضافة/تعديل منتج
│   ├── auth/                  # مكونات المصادقة
│   ├── ui/                    # مكونات UI أساسية
│   ├── CategoryDropdown.tsx   # قائمة الفئات
│   ├── UserMenu.tsx           # قائمة المستخدم
│   ├── WeatherPopup.tsx       # نافذة الطقس
│   └── PasswordStrengthMeter.tsx
│
├── lib/
│   ├── api.ts                 # ✅ مكتبة API مركزية
│   ├── supabaseClient.ts      # Supabase client
│   ├── translations.ts        # الترجمات (ar/en)
│   ├── imageUtils.ts          # معالجة الصور
│   ├── weather.ts             # API الطقس
│   └── auth-helpers.ts        # مساعدات المصادقة
│
├── hooks/
│   ├── index.ts               # ✅ exports الموحدة
│   ├── useTableData.ts        # جلب بيانات الجداول
│   ├── useDelete.ts           # حذف/استعادة
│   └── useUsers.ts            # ✅ إدارة المستخدمين
│
├── contexts/
│   └── AppContext.tsx         # ✅ Global state management
│
├── config/
│   └── tables.ts              # إعدادات الجداول
│
└── public/assets/images/      # الصور الثابتة
```

## 🔑 المميزات الرئيسية

### ✅ Architecture
- **Modular Design:** كل ملف له مسؤولية واحدة
- **Type Safety:** TypeScript صارم في كل مكان
- **Error Handling:** معالجة شاملة للأخطاء
- **Reusability:** مكونات ومكتبات قابلة لإعادة الاستخدام

### ✅ API Layer
- **lib/api.ts:** مكتبة API مركزية موحدة
- **معالجة أخطاء موحدة:** كل الـ API calls بنفس النمط
- **Type Safety:** interfaces لكل الـ data types

### ✅ State Management
- **AppContext:** Global state للـ language, user, notifications
- **Custom Hooks:** useUsers, useProducts, useTableData, useDelete
- **Local Storage:** حفظ الإعدادات (language, dark mode)

### ✅ Data Fetching
- **useTableData:** جلب بيانات مع pagination, filtering, sorting
- **useDelete:** حذف واستعادة مع error handling
- **useUsers:** إدارة المستخدمين كاملة

### ✅ UI Components
- **DataTable:** جدول بيانات متكامل مع floating header
- **Pagination:** تقسيم الصفحات مع اختيار العدد
- **ProductModal:** نافذة إضافة/تعديل منتج مع رفع صور

## 🛠️ الاستخدام

### 1. استخدام API Library:

```typescript
import { api } from '@/lib/api';

// جلب المستخدمين
const response = await api.getUsers();
if (response.success) {
  console.log(response.data.users);
}

// إنشاء منتج
const result = await api.createProduct({
  name: 'منتج جديد',
  sell_price: 100,
});
```

### 2. استخدام Custom Hooks:

```typescript
import { useUsers, useProducts, useTableData } from '@/hooks';

// في المكون
function UsersPage() {
  const { users, loading, createUser, deleteUser } = useUsers();
  const { products, loading: productsLoading } = useProducts();
  
  const { 
    data, 
    loading, 
    currentPage, 
    totalPages, 
    setPage 
  } = useTableData('products', { limit: 25 });
  
  // استخدام مباشر
  if (loading) return <Loading />;
  
  return <div>{users.map(...)}</div>;
}
```

### 3. استخدام App Context:

```typescript
import { useApp } from '@/contexts/AppContext';

function MyComponent() {
  const { 
    language, 
    toggleLanguage, 
    currentUser, 
    showNotification,
    isDarkMode,
    toggleDarkMode 
  } = useApp();
  
  // إظهار إشعار
  showNotification('تم الحفظ بنجاح', 'success');
  
  return <div>...</div>;
}
```

### 4. استخدام DataTable:

```typescript
import DataTable from '@/components/data/DataTable';
import { tableConfigs } from '@/config/tables';

function ProductsPage() {
  const { data, loading } = useTableData('products');
  
  return (
    <DataTable
      tableName="products"
      columns={tableConfigs.products.columns}
      data={data}
      onEdit={handleEdit}
      onDelete={handleDelete}
      loading={loading}
    />
  );
}
```

### 5. استخدام Pagination:

```typescript
import Pagination from '@/components/data/Pagination';

function ProductsPage() {
  const { 
    data, 
    currentPage, 
    totalPages, 
    totalCount,
    setPage,
    setLimit 
  } = useTableData('products', { limit: 25 });
  
  return (
    <>
      <DataTable ... />
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={25}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
    </>
  );
}
```

## 🎨 نظام التصميم

### الألوان:
```css
--gold: #DBA935       /* ذهبي */
--darkwhite: #3E3B3F  /* رمادي داكن */
--silver: #c0c0c0     /* فضي */
--bg-dark: #1a1a1a    /* خلفية داكنة */
--bg-card: #2a2a2a    /* خلفية البطاقات */
```

## 🔐 الأمان

### Environment Variables:
```env
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### Best Practices:
- ✅ استخدام Service Role Key فقط في server-side APIs
- ✅ تشفير كلمات المرور (bcrypt)
- ✅ معالجة جميع الأخطاء
- ✅ Validate inputs قبل الحفظ
- ✅ استخدام RLS Policies في Supabase

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/ZElectronic23/ERP.git

# 2. Install
npm install

# 3. Setup .env.local
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# 4. Create Buckets in Supabase Storage:
- avatars (Public)
- products (Public)

# 5. Run
npm run dev
```

## 📝 ملاحظات هامة

1. **قبل البدء:** تأكد من إنشاء buckets في Supabase
2. **عند الخطأ:** راجع Console → Network → Response
3. **للأداء:** استخدم React.memo() للمكونات الكبيرة
4. **للصيانة:** كل ملف له مسؤولية واحدة فقط

## 📞 التواصل

**GitHub:** https://github.com/ZElectronic23/ERP.git  
**Support:** WhatsApp +20 100 449 6397

---

**آخر تحديث:** 2026-03-11  
**الإصدار:** 2.0.0 (Architecture Refactor)
#   p r o j e c t - n e w  
 