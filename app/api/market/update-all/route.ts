// Phase 2: "Update All Market Data". Refreshes each indicator from its source, isolating
// failures (one bad source never corrupts others), logs full history (prev→current, %change,
// source, date, verification). NEVER modifies approved selling prices.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { canManageMarket } from '@/lib/market/auth';

async function fetchFx(): Promise<number | null> {
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
        const j = await res.json();
        const egp = Number(j?.rates?.EGP);
        return egp > 0 ? egp : null;
    } catch { return null; }
}

export async function POST() {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageMarket(authed.profile.role_key, authed.profile.is_admin)) {
        return NextResponse.json({ error: 'تحديث بيانات السوق للإدارة/المالية فقط / Market update is management/finance only' }, { status: 403 });
    }
    const who = authed.profile.email || null;

    const { data: indicators } = await supabaseAdmin.from('market_indicators').select('*');
    const live = await fetchFx(); // only FX has a reliable free source; others stay manual (no invented values)
    const results: any[] = [];

    for (const ind of indicators || []) {
        try {
            let newValue = Number(ind.value);
            let verification = 'needs_verification';
            if (ind.key === 'usd_egp') {
                if (live != null) { newValue = live; verification = 'verified'; }
                else { verification = 'failed'; } // FX source failed → keep old value, flag it only
            }
            const prev = ind.value != null ? Number(ind.value) : null;
            const pct = (prev && prev !== 0) ? ((newValue - prev) / prev) * 100 : null;

            await supabaseAdmin.from('market_indicators').update({
                previous_value: prev, value: newValue, verification,
                updated_at: new Date().toISOString(), updated_by: who,
            }).eq('id', ind.id);

            await supabaseAdmin.from('market_data_history').insert({
                key: ind.key, value: newValue, previous_value: prev,
                pct_change: pct != null ? Number(pct.toFixed(4)) : null,
                unit: ind.unit, currency: ind.currency, source: ind.source, source_url: ind.source_url,
                verification, recorded_by: who,
            });

            // keep app_settings.usd_egp in sync so the pricing engine uses the latest FX reference.
            // This affects COST/reference only — approved sell_price is never changed here.
            if (ind.key === 'usd_egp' && verification === 'verified') {
                await supabaseAdmin.from('app_settings').upsert({ key: 'usd_egp', value: String(newValue), updated_at: new Date().toISOString() });
            }

            results.push({ key: ind.key, ok: verification !== 'failed', value: newValue, previous: prev, pct_change: pct, verification });
        } catch (e: any) {
            results.push({ key: ind.key, ok: false, error: e.message });
        }
    }

    return NextResponse.json({ updated_at: new Date().toISOString(), count: results.length, results });
}
