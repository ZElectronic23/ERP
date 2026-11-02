// List current market indicators (+ sources), and recent history for one indicator.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { canManageMarket } from '@/lib/market/auth';

export async function GET(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const key = new URL(request.url).searchParams.get('key');
    if (key) {
        const { data } = await supabaseAdmin.from('market_data_history').select('*').eq('key', key).order('recorded_at', { ascending: false }).limit(50);
        return NextResponse.json({ history: data || [] });
    }
    const [{ data: indicators }, { data: sources }] = await Promise.all([
        supabaseAdmin.from('market_indicators').select('*').order('category').order('key'),
        supabaseAdmin.from('market_sources').select('authority, topic, usage_note, url, verified').order('authority'),
    ]);
    return NextResponse.json({
        indicators: indicators || [], sources: sources || [],
        canManage: canManageMarket(authed.profile.role_key, authed.profile.is_admin),
    });
}
