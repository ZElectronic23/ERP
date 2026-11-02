// Central approvals inbox: the actionable pending steps the signed-in user may decide
// (earliest-pending step per cycle, not their own request, role permitted) plus the user's
// own requests with their overall status. Decisions still go through PATCH /api/approvals,
// which re-enforces every rule server-side — this endpoint only curates the list.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { canDecide } from '@/lib/approvals/roles';

function overall(rows: { status: string }[]): string {
    if (rows.length === 0) return 'draft';
    if (rows.some(r => r.status === 'rejected')) return 'rejected';
    if (rows.every(r => r.status === 'approved')) return 'approved';
    return 'in_review';
}

const keyOf = (r: any) => `${r.entity_type}|${r.entity_id}|${r.cycle}`;

export async function GET() {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = authed.profile.entity_id;

    // All open cycles (any cycle that still has a pending step), plus all the user's own rows.
    const { data: pendingRows } = await supabaseAdmin.from('approvals').select('*').eq('status', 'pending');
    const openKeys = new Set((pendingRows || []).map(keyOf));

    // Fetch the full step set for each open cycle so we can find the earliest pending step.
    const assigned: any[] = [];
    if (openKeys.size) {
        const { data: allOpen } = await supabaseAdmin.from('approvals').select('*')
            .in('entity_type', Array.from(new Set((pendingRows || []).map(r => r.entity_type))));
        const byKey = new Map<string, any[]>();
        for (const r of allOpen || []) {
            if (!openKeys.has(keyOf(r))) continue;
            const k = keyOf(r);
            (byKey.get(k) || byKey.set(k, []).get(k)!).push(r);
        }
        for (const rows of byKey.values()) {
            const pend = rows.filter(r => r.status === 'pending').sort((a, b) => a.step_order - b.step_order);
            const active = pend[0];
            if (!active) continue;
            if (active.requested_by === me) continue; // can't act on own request
            if (!canDecide(active.required_role || null, authed.profile.role_key, authed.profile.is_admin)) continue;
            assigned.push({
                id: active.id, entity_type: active.entity_type, entity_id: active.entity_id,
                title: active.title, required_role: active.required_role,
                requested_by_name: active.requested_by_name, step_order: active.step_order,
                total_steps: rows.length, acted_at: active.acted_at,
            });
        }
    }

    // The user's own requests, grouped into one card per cycle with its overall status.
    const { data: mineRows } = await supabaseAdmin.from('approvals').select('*').eq('requested_by', me);
    const mineByKey = new Map<string, any[]>();
    for (const r of mineRows || []) {
        const k = keyOf(r);
        (mineByKey.get(k) || mineByKey.set(k, []).get(k)!).push(r);
    }
    const mine = Array.from(mineByKey.values()).map(rows => {
        rows.sort((a, b) => a.step_order - b.step_order);
        const status = overall(rows);
        const current = rows.find(r => r.status === 'pending');
        return {
            entity_type: rows[0].entity_type, entity_id: rows[0].entity_id, cycle: rows[0].cycle,
            status, current_step: current?.title || null,
            steps: rows.map(r => ({ title: r.title, status: r.status, approver_name: r.approver_name, note: r.note, acted_at: r.acted_at })),
        };
    });

    return NextResponse.json({ assigned, mine, role: authed.profile.role_key, is_admin: authed.profile.is_admin });
}
