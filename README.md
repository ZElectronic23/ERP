# نظام Z.Electronic ERP

نظام إدارة الموارد المؤسسية المتكامل - Z.Electronic  
**الإصدار:** 2.1.0 | **آخر تحديث:** 2026-03-15

---

## 🌟 نظرة عامة

نظام ERP متكامل مبني باستخدام أحدث التقنيات لتلبية احتياجات الشركات الصغيرة والمتوسطة.  
يدعم النظام اللغة العربية والإنجليزية بشكل كامل، مع واجهة مستخدم سلسة ومتجاوبة.

---

## ✨ المميزات الرئيسية

- 🔐 **نظام مصادقة متكامل** (تسجيل دخول/خروج) مع Supabase Auth
- 👥 **إدارة المستخدمين** (إضافة، تعديل، حذف ناعم، استعادة، تغيير الحالة)
- 📦 **إدارة المنتجات** (قريباً: CRUD كامل مع الصور والتصنيفات)
- 📊 **جداول بيانات متقدمة** (بحث، تصفية، ترتيب، تقسيم صفحات)
- 🌐 **دعم كامل للغتين** العربية والإنجليزية (RTL/LTR)
- 🎨 **واجهة مستخدم عصرية** (Dark Mode، تأثيرات blur، ألوان ذهبية وفضية)
- 📱 **تصميم متجاوب** مع جميع أحجام الشاشات
- 🖼️ **رفع الصور** (صور المنتجات، الصور الشخصية) مع ضغط تلقائي
- 🔔 **نظام إشعارات فوري** باستخدام Supabase Realtime
- 🔒 **أمان متقدم** (Service Role Key للخادم، RLS Policies، تشفير كلمات المرور)
- 📞 **دعم فني عبر واتساب** مباشرة من التطبيق

---

## 🛠️ التقنيات المستخدمة

- **Framework:** Next.js 16 (App Router)
- **اللغة:** TypeScript
- **قاعدة البيانات والمصادقة:** Supabase (PostgreSQL، Auth، Storage، Realtime)
- **التصميم:** Tailwind CSS + Tailwind Forms/Typography
- **الترجمة:** next-intl
- **إدارة الحالة:** React Context API
- **المكتبات المساعدة:** 
  - `browser-image-compression` لضغط الصور
  - `uuid` لإنشاء معرفات فريدة
  - `bcrypt` لتشفير كلمات المرور (على الخادم)

---

## 📂 هيكل المشروع
ERP/
├── app/
│ ├── (auth)/login/page.tsx # صفحة تسجيل الدخول
│ ├── admin/users/ # إدارة المستخدمين
│ │ ├── api/ # API endpoints
│ │ │ ├── route.ts # GET, POST
│ │ │ ├── [id]/route.ts # PATCH
│ │ │ ├── delete/route.ts # DELETE (soft/hard)
│ │ │ ├── restore/route.ts # POST restore
│ │ │ └── status/route.ts # PATCH status
│ │ └── page.tsx
│ ├── products/ # إدارة المنتجات
│ │ ├── page.tsx
│ │ └── deleted/page.tsx
│ ├── dashboard/page.tsx # لوحة التحكم
│ ├── layout.tsx # Layout رئيسي مع الخلفية والهيدر
│ ├── globals.css # أنماط CSS العامة
│ └── not-found.tsx # صفحة 404
│
├── components/
│ ├── data/
│ │ ├── DataTable.tsx # جدول بيانات متكامل
│ │ ├── Pagination.tsx # تقسيم الصفحات
│ │ └── SearchFilter.tsx # فلترة البحث
│ ├── modals/
│ │ ├── ProductModal.tsx # نافذة إضافة/تعديل منتج
│ │ └── EditUserModal.tsx # نافذة تعديل المستخدم
│ ├── ui/
│ │ ├── Dropdown.tsx # قائمة منسدلة عامة
│ │ ├── CategoryDropdown.tsx # قائمة الفئات للمنتجات
│ │ └── PasswordStrengthMeter.tsx # مؤشر قوة كلمة المرور
│ ├── Header.tsx # الهيدر الموحد
│ ├── NotificationBell.tsx # جرس الإشعارات مع القائمة
│ ├── UserMenu.tsx # قائمة المستخدم
│ ├── FloatingActions.tsx # الأزرار العائمة (واتساب + مساعد)
│ └── AIChatModal.tsx # نافذة الدردشة مع المساعد
│
├── hooks/
│ ├── index.ts # تصدير موحد
│ ├── useTableData.ts # جلب بيانات الجداول
│ ├── useDelete.ts # عمليات الحذف والاستعادة
│ └── useUsers.ts # إدارة المستخدمين
│
├── lib/
│ ├── supabaseClient.ts # تهيئة Supabase
│ ├── api.ts # دوال API مركزية
│ ├── imageUtils.ts # دوال معالجة الصور
│ ├── auth-helpers.ts # مساعدات المصادقة
│ └── translations.ts # تكوين الترجمة
│
├── contexts/
│ └── AppContext.tsx # حالة التطبيق العامة
│
├── types/
│ └── index.ts # تعريفات TypeScript
│
├── config/
│ ├── locales.ts # قائمة اللغات المدعومة
│ └── tables.ts # إعدادات الجداول
│
├── messages/
│ ├── ar.json # الترجمة العربية
│ └── en.json # الترجمة الإنجليزية
│
├── public/
│ └── assets/images/ # الصور الثابتة
│ ├── ERP.svg
│ ├── user.svg
│ ├── notification.svg
│ ├── AI.svg
│ ├── Whatsapp.svg
│ ├── cloud.svg
│ ├── search.ico
│ ├── add.png
│ ├── left.svg
│ ├── right.svg
│ ├── delete.svg
│ ├── product.svg
│ └── BG.png
│
├── .env.local # متغيرات البيئة (لا ترفع)
├── .gitignore
├── package.json
├── tailwind.config.ts
├── next.config.ts
└── README.md

text

---

## 🚀 طريقة التشغيل السريع

### 1. استنساخ المستودع
```bash
git clone https://github.com/ZElectronic23/ERP.git
cd ERP
2. تثبيت الاعتماديات
bash
npm install
# أو
yarn install
3. إعداد متغيرات البيئة
أنشئ ملف .env.local في المجلد الرئيسي:

env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
4. إعداد Supabase
قم بإنشاء buckets في Storage:

avatars (عام) - للصور الشخصية

products (عام) - لصور المنتجات

فعّل RLS Policies على الجداول

شغّل التطبيق لتجربة تسجيل الدخول.

5. تشغيل خادم التطوير
bash
npm run dev
افتح http://localhost:3000/ar للنسخة العربية.

📖 أمثلة استخدام الـ API و Hooks
استخدام api.ts (واجهة مركزية للـ API)
ts
import { api } from '@/lib/api';

// جلب المستخدمين
const response = await api.getUsers();
if (response.success) {
  console.log(response.data.users);
}

// إنشاء منتج
const newProduct = await api.createProduct({
  name: 'منتج جديد',
  sell_price: 100,
  cost_price: 70,
  category: 'إلكترونيات',
});
استخدام Custom Hooks
tsx
import { useUsers, useTableData } from '@/hooks';

function UsersPage() {
  const { users, loading, createUser, deleteUser } = useUsers();
  
  const {
    data: products,
    loading: productsLoading,
    currentPage,
    totalPages,
    setPage
  } = useTableData('products', { limit: 25 });

  if (loading || productsLoading) return <div>جاري التحميل...</div>;

  return (
    <div>
      <DataTable data={users} />
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
استخدام App Context
tsx
import { useApp } from '@/contexts/AppContext';

function MyComponent() {
  const { language, toggleLanguage, showNotification } = useApp();

  const handleSave = () => {
    showNotification('تم الحفظ بنجاح', 'success');
  };

  return (
    <button onClick={toggleLanguage}>
      {language === 'ar' ? 'English' : 'العربية'}
    </button>
  );
}
🎨 نظام الألوان (CSS Variables)
css
:root {
  --background: #3E3B3F;
  --foreground: #ffffff;
  --gold: #DBA935;
  --silver: #c0c0c0;
}
تستخدم في Tailwind عبر bg-gold, text-gold, border-gold/xx.

🔐 الأمان والإجراءات المتبعة
✅ استخدام Service Role Key فقط في Server Components و API Routes (ليس في Client)

✅ تشفير كلمات المرور باستخدام bcrypt عند إنشاء المستخدمين عبر API

✅ جميع الطلبات إلى Supabase من Client تستخدم anon key مع RLS Policies

✅ التحقق من صحة المدخلات (Validation) قبل الحفظ

✅ معالجة الأخطاء بشكل شامل وعرض رسائل مناسبة للمستخدم

✅ حماية الصور باستخدام سياسات التخزين المناسبة

✅ المميزات المكتملة
نظام مصادقة كامل (تسجيل دخول/خروج) مع Supabase Auth

إدارة المستخدمين (CRUD + Soft Delete + استعادة)

إدارة المنتجات الأساسية (عرض، بحث، تصفية)

جداول بيانات متكاملة مع Pagination وترتيب

دعم كامل للغتين (العربية/الإنجليزية) مع RTL/LTR

واجهة مستخدم Dark Mode مع ألوان متناسقة

رفع الصور وضغطها تلقائياً

إشعارات فورية باستخدام Supabase Realtime

أزرار عائمة (واتساب دعم فني + مساعد ذكي)

صفحة 404 مخصصة

🔄 المميزات قيد التطوير
إدارة كاملة للمنتجات (إضافة، تعديل، حذف) مع الصور

نظام المخزون والمستودعات (تتبع الكميات)

إدارة العملاء والموردين

نظام الفواتير الإلكترونية

التقارير والإحصائيات المتقدمة

نظام الصلاحيات والأدوار (RBAC)

دفع إلكتروني وتكامل مع بوابات الدفع
(auth) بدلاً منه، تأكد من عدم استخدامه
أي صور غير مستخدمة في public/assets/images/	مثل صور قديمة لم تعد مشار إليها في الكود
تنبيه: قبل الحذف، تأكد من أن أي ملف لا يتم استيراده في أي مكان آخر باستخدام البحث الشامل.

📞 التواصل والدعم
البريد الإلكتروني: z.electronic23@gmail.com

واتساب: +20 100 449 6397

GitHub: https://github.com/ZElectronic23/ERP.git

📄 الترخيص
هذا المشروع مرخص تحت رخصة MIT. يمكنك استخدامه وتعديله بحرية للأغراض التجارية والشخصية.

شكراً لاستخدامك نظام Z.Electronic ERP!
نتمنى لك تجربة ممتعة وفعالة. 😊