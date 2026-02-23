import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { Cairo } from 'next/font/google' // Cairo كبديل لـ Alata

// يمكنك استخدام Cairo وهو قريب من Alata، أو تحميل Alata من Google Fonts
// const alata = Alata({ subsets: ["arabic", "latin"], weight: "400" });

export default async function ProductsPage() {
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

    if (error) {
        return (
            <div className="min-h-screen bg-[#3E3B3F] flex items-center justify-center p-4">
                <div className="bg-[#3E3B3F]/90 backdrop-blur-lg rounded-3xl p-8 text-white border border-[#c0c0c0]/30 shadow-2xl" style={{ backgroundColor: '#3E3B3F' }}>
                    <p className="text-[#DBA935]">خطأ في تحميل البيانات: {error.message}</p>
                </div>
            </div>
        )
    }

    return (
        // الخلفية الأساسية بالرمادي الداكن
        <div className="min-h-screen bg-[#3E3B3F] p-4 md:p-6 lg:p-8" dir="rtl">

            {/* الشريط العلوي (زجاجي بألوان رمادية) */}
            <div className="bg-[#3E3B3F]/80 backdrop-blur-md rounded-2xl px-6 py-3 mb-6 flex justify-between items-center border border-[#c0c0c0]/20 shadow-xl">
                <div className="flex items-center gap-4">
                    <button className="px-4 py-2 rounded-xl bg-[#c0c0c0]/20 hover:bg-[#DBA935] text-white hover:text-[#3E3B3F] transition-all duration-300 border border-[#c0c0c0]/30 text-sm font-semibold">
                        EN
                    </button>
                    <h1 className="text-white font-bold text-lg hidden md:block">Z.Electronic ERP</h1>
                </div>
                <div className="flex items-center gap-4 text-white/80">
                    <span className="material-icons text-[#DBA935]">schedule</span>
                    <span className="text-sm">{new Date().toLocaleTimeString('ar-EG')}</span>
                    <span className="text-white/40 hidden md:inline">|</span>
                    <span className="text-sm hidden md:inline">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>

            {/* رأس الصفحة */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2" style={{ fontFamily: 'Alata, sans-serif' }}>📦 إدارة المنتجات</h1>
                    <p className="text-[#c0c0c0]">عرض وإدارة جميع المنتجات في المخزن</p>
                </div>
                <button className="px-6 py-3 bg-[#DBA935] hover:bg-yellow-600 text-[#3E3B3F] font-bold rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl">
                    <span className="material-icons">add</span>
                    إضافة منتج جديد
                </button>
            </div>

            {/* شبكة المنتجات */}
            {products && products.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {products.map((product) => (
                        <div
                            key={product.product_id}
                            className="group bg-[#3E3B3F]/80 backdrop-blur-sm rounded-3xl p-5 border border-[#c0c0c0]/20 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:border-[#DBA935]/50"
                        >
                            {/* شريط علوي للكارت */}
                            <div className="flex justify-between items-start mb-3">
                                <span className="px-3 py-1 bg-[#DBA935]/20 text-[#DBA935] rounded-full text-xs font-semibold border border-[#DBA935]/30">
                                    {product.category || 'عام'}
                                </span>
                                <span className="text-[#c0c0c0] text-sm">#{product.product_id}</span>
                            </div>

                            {/* اسم المنتج */}
                            <h2 className="text-xl font-bold text-white mb-3 line-clamp-2 min-h-[3.5rem]" style={{ fontFamily: 'Alata, sans-serif' }}>
                                {product.name}
                            </h2>

                            {/* تفاصيل المنتج */}
                            <div className="space-y-2 text-sm text-[#c0c0c0] mb-4">
                                <div className="flex justify-between items-center border-b border-[#c0c0c0]/10 pb-1">
                                    <span>💰 سعر البيع</span>
                                    <span className="font-bold text-white">
                                        {product.sell_price ? `${product.sell_price} ج.م` : 'غير محدد'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center border-b border-[#c0c0c0]/10 pb-1">
                                    <span>📦 التكلفة</span>
                                    <span className="font-bold text-white">
                                        {product.cost_price ? `${product.cost_price} ج.م` : 'غير محدد'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center border-b border-[#c0c0c0]/10 pb-1">
                                    <span>📊 الكمية</span>
                                    <span className="font-bold text-white">{product.stock_quantity || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>📏 الوحدة</span>
                                    <span className="font-bold text-white">{product.unit || '—'}</span>
                                </div>
                            </div>

                            {/* أزرار التحكم */}
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <button className="flex-1 px-3 py-2 bg-[#c0c0c0]/20 hover:bg-[#DBA935] rounded-xl text-white hover:text-[#3E3B3F] transition-colors duration-300 flex items-center justify-center gap-1 text-sm">
                                    <span className="material-icons text-sm">edit</span>
                                    تعديل
                                </button>
                                <button className="flex-1 px-3 py-2 bg-[#c0c0c0]/10 hover:bg-red-500/80 rounded-xl text-white transition-colors duration-300 flex items-center justify-center gap-1 text-sm">
                                    <span className="material-icons text-sm">delete</span>
                                    حذف
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-[#3E3B3F]/80 backdrop-blur-md rounded-3xl p-12 text-center border border-[#c0c0c0]/20">
                    <span className="material-icons text-6xl text-[#c0c0c0]/30 mb-4">inventory</span>
                    <p className="text-[#c0c0c0] text-lg">لا توجد منتجات حالياً</p>
                    <button className="mt-4 px-6 py-2 bg-[#DBA935] text-[#3E3B3F] rounded-xl hover:bg-yellow-600 transition">
                        إضافة أول منتج
                    </button>
                </div>
            )}
        </div>
    )
}