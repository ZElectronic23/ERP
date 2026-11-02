// Tech-support / CRM admin API (gated to support/CRM/sales/admin/ceo via the 'support' module).
// GET: client tickets (client_requests), pending client data-update requests, and clients due for
// follow-up. PATCH: move a ticket's status / assign it; or APPROVE a data-update request (which
// applies the changes to the clients row, incl. confirmed location) or reject it.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { buildAccess } from '@/lib/auth/access';

async function gate() {
    const authed = await requireUser();
    if (!authed) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    const { data: perms } = await supabaseAdmin.from('user_permissions').select('module, can_view').eq('user_id', authed.profile.entity_id);
    const access = buildAccess(authed.profile, perms);
    if (!access.isFull && !access.has('support')) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    return { authed };
}

const TICKET_STATUSES = ['submitted', 'planning', 'survey', 'waiting', 'support_received', 'in_progress', 'closed', 'open'];
// Fields a client may update, mapped to the real (quoted) column names on `clients`.
const FIELD_MAP: Record<string, string> = {
    mobile: 'Mobile No.', email: 'E-Mail', address: 'Address',
    commercial_reg_no: 'commercial_reg_no', id_card_no: 'id_card_no', lat: 'lat', lng: 'lng',
};

export async function GET() {
    const g = await gate();
    if (g.error) return g.error;
    const [tickets, updates, clients] = await Promise.all([
        supabaseAdmin.from('client_requests').select('*').order('created_at', { ascending: false }).limit(200),
        supabaseAdmin.from('client_update_requests').select('*').order('created_at', { ascending: false }).limit(100),
        supabaseAdmin.from('clients').select('"ClientId","ClientName","Mobile No.","E-Mail",NextFollowUpDate,LastFollowUpDate').is('deleted_at', null).eq('client_kind', 'actual'),
    ]);
    const nameMap: Record<string, string> = {};
    (clients.data || []).forEach((c: any) => { nameMap[c.ClientId] = c.ClientName; });
    // follow-ups due (NextFollowUpDate today or past)
    const today = new Date().toISOString().slice(0, 10);
    const followUps = (clients.data || []).filter((c: any) => c.NextFollowUpDate && String(c.NextFollowUpDate).slice(0, 10) <= today);
    return NextResponse.json({
        tickets: (tickets.data || []).map((t: any) => ({ ...t, client_name: nameMap[t.client_id] || t.client_id })),
        updates: (updates.data || []).map((u: any) => ({ ...u, client_name: nameMap[u.client_id] || u.client_id })),
        followUps, statuses: TICKET_STATUSES,
    });
}

export async function PATCH(request: Request) {
    const g = await gate();
    if (g.error) return g.error;
    const b = await request.json().catch(() => ({}));

    // ----- ticket status / assignment -----
    if (b.type === 'ticket') {
        const id = (b.id || '').toString();
        const patch: Record<string, any> = { updated_at: new Date().toISOString() };
        if (b.status) {
            if (!TICKET_STATUSES.includes(b.status)) return NextResponse.json({ error: 'bad status' }, { status: 400 });
            patch.status = b.status;
        }
        if (b.description !== undefined) patch.description = b.description;
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
        const { error } = await supabaseAdmin.from('client_requests').update(patch).eq('id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    }

    // ----- client data-update request: approve (apply) or reject -----
    if (b.type === 'update') {
        const id = (b.id || '').toString();
        const { data: req } = await supabaseAdmin.from('client_update_requests').select('*').eq('id', id).maybeSingle();
        if (!req) return NextResponse.json({ error: 'not found' }, { status: 404 });
        if (req.status !== 'pending') return NextResponse.json({ error: 'already decided' }, { status: 409 });
        const who = g.authed!.profile.email || null;

        if (b.decision === 'approved') {
            // Apply the approved changes to the real clients row (verified by a human reviewer).
            const changes = req.changes || {};
            const update: Record<string, any> = {};
            for (const [k, v] of Object.entries(changes)) {
                const col = FIELD_MAP[k];
                if (col) update[col] = v;
            }
            if ('lat' in changes || 'lng' in changes) update.location_confirmed_at = new Date().toISOString();
            if (Object.keys(update).length) {
                const { error: upErr } = await supabaseAdmin.from('clients').update(update).eq('ClientId', req.client_id);
                if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
            }
            await supabaseAdmin.from('client_update_requests').update({ status: 'approved', reviewed_by: who, reviewed_at: new Date().toISOString(), review_note: b.note || null }).eq('id', id);
            return NextResponse.json({ ok: true, applied: true });
        }
        if (b.decision === 'rejected') {
            await supabaseAdmin.from('client_update_requests').update({ status: 'rejected', reviewed_by: who, reviewed_at: new Date().toISOString(), review_note: b.note || null }).eq('id', id);
            return NextResponse.json({ ok: true, applied: false });
        }
        return NextResponse.json({ error: 'decision must be approved|rejected' }, { status: 400 });
    }

    // ----- mark a client followed-up (bumps next follow-up by its frequency if set) -----
    if (b.type === 'followup') {
        const cid = (b.client_id || '').toString();
        if (!cid) return NextResponse.json({ error: 'client_id required' }, { status: 400 });
        await supabaseAdmin.from('clients').update({ LastFollowUpDate: new Date().toISOString().slice(0, 10), NextFollowUpDate: b.next || null }).eq('ClientId', cid);
        return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown type' }, { status: 400 });
}
