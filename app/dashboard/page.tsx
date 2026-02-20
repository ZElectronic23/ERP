import { supabase } from '@/lib/supabaseClient'

export default async function DashboardPage() {
  console.log('محاولة جلب البيانات...')
  
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .limit(20)

  console.log('النتيجة:', { products, error })

  if (error) {
    return <div>خطأ في تحميل البيانات: {error.message}</div>
  }

  return (
    <div className="container mx-auto py-8 px-4" dir="rtl">
      <h1 className="text-2xl font-bold mb-6">قائمة المنتجات</h1>
      <p>عدد المنتجات المسترجعة: {products?.length || 0}</p> {/* سطر جديد للتأكد */}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products?.map((product) => (
          <div key={product.product_id} className="border rounded-lg p-4 shadow-sm hover:shadow-md transition">
            <h2 className="font-bold text-lg mb-2">{product.name}</h2>
            <div className="space-y-1 text-sm">
              <p><span className="font-semibold">الكود:</span> {product.product_id}</p>
              <p><span className="font-semibold">الفئة:</span> {product.category}</p>
              <p><span className="font-semibold">سعر البيع:</span> {product.sell_price || 'غير محدد'} ج.م</p>
              <p><span className="font-semibold">سعر التكلفة:</span> {product.cost_price || 'غير محدد'} ج.م</p>
              <p><span className="font-semibold">الكمية:</span> {product.stock_quantity}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}