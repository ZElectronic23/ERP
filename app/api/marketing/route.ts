// Marketing & advertising campaigns (gated to the 'marketing' module / full access).
// GET: campaigns + a roll-up summary. POST: create a campaign. PATCH: update one (spend/leads/status…).
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { buildAccess } from '@/lib/auth/access';

async function gate() {
    const authed = await requireUser();
    if (!authed) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    const { data: perms } = await supabaseAdmin.from('user_permissions').select('module, can_view').eq('user_id', authed.profile.entity_id);
    const access = buildAccess(authed.profile, perms);
    if (!access.isFull && !access.has('marketing')) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    return { authed };
}

const CHANNELS = ['facebook', 'instagram', 'google', 'whatsapp', 'referral', 'other'];
const STATUSES = ['planned', 'active', 'paused', 'done'];

export async function GET() {
    const g = await gate();
    if (g.error) return g.error;
    const { data } = await supabaseAdmin.from('marketing_campaigns').select('*').order('created_at', { ascending: false });
    const rows = data || [];
    const sum = rows.reduce((a: any, c: any) => ({
        budget: a.budget + (Number(c.budget) || 0), spend: a.spend + (Number(c.spend) || 0),
        leads: a.leads + (Number(c.leads) || 0), conversions: a.conversions + (Number(c.conversions) || 0),
        active: a.active + (c.status === 'active' ? 1 : 0),
    }), { budget: 0, spend: 0, leads: 0, conversions: 0, active: 0 });
    // cost per lead / conversion rate
    const costPerLead = sum.leads ? Math.round(sum.spend / sum.leads) : null;
    const convRate = sum.leads ? Math.round((sum.conversions / sum.leads) * 100) : null;
    return NextResponse.json({ campaigns: rows, summary: { ...sum, costPerLead, convRate }, channels: CHANNELS, statuses: STATUSES });
}

export async function POST(request: Request) {
    const g = await gate();
    if (g.error) return g.error;
    const b = await request.json().catch(() => ({}));
    const name = (b.name || '').toString().trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('marketing_campaigns').insert({
        name, channel: CHANNELS.includes(b.channel) ? b.channel : 'other',
        status: STATUSES.includes(b.status) ? b.status : 'planned',
        budget: Number(b.budget) || 0, spend: Number(b.spend) || 0,
        leads: parseInt(b.leads) || 0, conversions: parseInt(b.conversions) || 0,
        start_date: b.start_date || null, end_date: b.end_date || null, notes: b.notes || null,
        created_by: g.authed!.profile.email || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
    const g = await gate();
    if (g.error) return g.error;
    const b = await request.json().catch(() => ({}));
    const id = (b.id || '').toString();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (b.status && STATUSES.includes(b.status)) patch.status = b.status;
    if (b.channel && CHANNELS.includes(b.channel)) patch.channel = b.channel;
    for (const k of ['budget', 'spend', 'leads', 'conversions']) if (b[k] !== undefined) patch[k] = Number(b[k]) || 0;
    if (b.notes !== undefined) patch.notes = b.notes;
    const { error } = await supabaseAdmin.from('marketing_campaigns').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
    const g = await gate();
    if (g.error) return g.error;
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await supabaseAdmin.from('marketing_campaigns').delete().eq('id', id);
    return NextResponse.json({ ok: true });
}
