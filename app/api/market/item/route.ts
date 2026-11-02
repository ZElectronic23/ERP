// Per-item market intelligence: GET reads aggregated intel + snapshot history for one
// product/service; POST appends a new market-price snapshot (append-only, never touches
// the item's approved sell_price). Recording is gated to management/finance like other
// market-data changes; reading is open to any authenticated user.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { canManageMarket } from '@/lib/market/auth';

type ItemType = 'product' | 'service';

function parseItem(url: URL): { itemType: ItemType; itemId: string } | null {
    const itemType = url.searchParams.get('type');
    const itemId = url.searchParams.get('id');
    if ((itemType !== 'product' && itemType !== 'service') || !itemId) return null;
    return { itemType, itemId };
}

export async function GET(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const item = parseItem(url);
    if (!item) return NextResponse.json({ error: 'type (product|service) and id are required' }, { status: 400 });

    const [{ data: intel }, { data: history }] = await Promise.all([
        supabaseAdmin.from('item_market_intelligence').select('*')
            .eq('item_type', item.itemType).eq('item_id', item.itemId).maybeSingle(),
        supabaseAdmin.from('item_market_snapshots')
            .select('id, source, source_url, price, currency, note, recorded_by, captured_at')
            .eq('item_type', item.itemType).eq('item_id', item.itemId)
            .order('captured_at', { ascending: false }).limit(60),
    ]);

    return NextResponse.json({
        intel: intel || null,
        history: history || [],
        canRecord: canManageMarket(authed.profile.role_key, authed.profile.is_admin),
    });
}

export async function POST(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageMarket(authed.profile.role_key, authed.profile.is_admin)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const b = await request.json().catch(() => ({}));
    const itemType = b.item_type === 'product' || b.item_type === 'service' ? b.item_type : null;
    const itemId = typeof b.item_id === 'string' ? b.item_id.trim() : '';
    const price = Number(b.price);
    if (!itemType || !itemId) return NextResponse.json({ error: 'item_type and item_id are required' }, { status: 400 });
    if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: 'price must be a non-negative number' }, { status: 400 });

    // Confirm the item actually exists before recording a snapshot against it.
    const table = itemType === 'product' ? 'products' : 'services';
    const idCol = itemType === 'product' ? 'product_id' : 'service_id';
    const { data: exists } = await supabaseAdmin.from(table).select(idCol).eq(idCol, itemId).maybeSingle();
    if (!exists) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const { data, error } = await supabaseAdmin.from('item_market_snapshots').insert({
        item_type: itemType,
        item_id: itemId,
        source: typeof b.source === 'string' && b.source.trim() ? b.source.trim() : 'manual',
        source_url: typeof b.source_url === 'string' && b.source_url.trim() ? b.source_url.trim() : null,
        price,
        currency: typeof b.currency === 'string' && b.currency.trim() ? b.currency.trim() : 'EGP',
        note: typeof b.note === 'string' && b.note.trim() ? b.note.trim() : null,
        recorded_by: authed.profile.email || null,
    }).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Keep the item's single market_avg_price in step with the recorded snapshots (avg of all),
    // for EGP snapshots only. This is market reference data — it never changes sell_price.
    const { data: intel } = await supabaseAdmin.from('item_market_intelligence').select('avg_price, currency')
        .eq('item_type', itemType).eq('item_id', itemId).maybeSingle();
    if (intel && (intel.currency === 'EGP' || !intel.currency) && intel.avg_price != null) {
        await supabaseAdmin.from(table).update({ market_avg_price: intel.avg_price }).eq(idCol, itemId);
    }

    return NextResponse.json({ ok: true, id: data?.id });
}
