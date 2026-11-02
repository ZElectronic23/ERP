// Phase 4: on-demand cross-module integration verifier (admin-only, read-only).
// Surfaces broken references and duplicates so integration is checked at the data level,
// not inferred from individually-working screens.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/requireAuth';

export async function GET() {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await supabaseAdmin.from('integration_health').select('*');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = data || [];
    const issues = rows.filter((r: any) => Number(r.issue_count) > 0);
    return NextResponse.json({
        checked_at: new Date().toISOString(),
        total_checks: rows.length,
        issues_found: issues.length,
        ok: issues.length === 0,
        checks: rows,
    });
}
