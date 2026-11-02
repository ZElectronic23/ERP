// app/api/market/fx/route.ts — refresh USD→EGP rate from a free public API
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireAuth';

export async function POST() {
    try {
        if (!(await requireUser())) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Free, no-key FX API
        const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
        const json = await res.json();
        const egp = json?.rates?.EGP;
        if (!egp) {
            return NextResponse.json({ error: 'Could not fetch USD/EGP rate' }, { status: 502 });
        }

        const admin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );
        await admin.from('app_settings').upsert({ key: 'usd_egp', value: String(egp), updated_at: new Date().toISOString() });

        return NextResponse.json({ usd_egp: egp, updated_at: new Date().toISOString() });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
