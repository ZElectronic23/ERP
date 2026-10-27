// app/api/documents/items/route.ts — Search products & services for document line items
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// GET /api/documents/items?search=cam&type=product|service|all&limit=30
export async function GET(req: NextRequest) {
  try {
    if (!(await requireUser())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);

    const results: any[] = [];

    // Search products
    if (type === 'all' || type === 'product') {
      let q = supabase
        .from('products')
        .select('product_id, name, unit, category, cost_price, sell_price, floor_price, target_price, direct_cost, loaded_cost, max_discount_pct')
        .order('name');

      if (search.trim()) {
        q = q.or(`name.ilike.%${search}%,category.ilike.%${search}%,product_id.ilike.%${search}%`);
      }

      const { data, error } = await q.limit(limit);
      if (error) throw error;

      if (data) {
        results.push(
          ...data.map((p) => ({
            id: p.product_id,
            item_type: 'product' as const,
            name: p.name,
            unit: p.unit || '',
            category: p.category || '',
            cost_price: p.cost_price ?? 0,
            sell_price: p.sell_price ?? 0,
            floor_price: p.floor_price ?? 0,
            target_price: p.target_price ?? 0,
            direct_cost: p.direct_cost ?? 0,
            loaded_cost: p.loaded_cost ?? 0,
            max_discount_pct: p.max_discount_pct ?? 0,
          }))
        );
      }
    }

    // Search services
    if (type === 'all' || type === 'service') {
      let q = supabase
        .from('services')
        .select('service_id, name, unit, category, cost_price, sell_price, floor_price, target_price, direct_cost, loaded_cost, max_discount_pct')
        .order('name');

      if (search.trim()) {
        q = q.or(`name.ilike.%${search}%,category.ilike.%${search}%,service_id.ilike.%${search}%`);
      }

      const { data, error } = await q.limit(limit);
      if (error) throw error;

      if (data) {
        results.push(
          ...data.map((s) => ({
            id: s.service_id,
            item_type: 'service' as const,
            name: s.name,
            unit: s.unit || '',
            category: s.category || '',
            cost_price: s.cost_price ?? 0,
            sell_price: s.sell_price ?? 0,
            floor_price: s.floor_price ?? 0,
            target_price: s.target_price ?? 0,
            direct_cost: s.direct_cost ?? 0,
            loaded_cost: s.loaded_cost ?? 0,
            max_discount_pct: s.max_discount_pct ?? 0,
          }))
        );
      }
    }

    // Sort combined results by name
    results.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ items: results.slice(0, limit), total: results.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
