// Server-side page guard: internal (staff) pages are rendered with the service-role client, which
// bypasses RLS — so each such page must refuse external CLIENTS itself. Call at the top of a
// server-component page; it redirects clients to their own portal (and unauthenticated → login).
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function guardInternalPage(locale: string) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect(`/${locale}/login`);
    const { data } = await supabaseAdmin.from('users').select('role_key, entity_type, status').eq('email', user!.email).maybeSingle();
    if (!data || data.status === 'deleted' || data.status === 'suspended') redirect(`/${locale}/login`);
    const rk = (data.role_key || '').toLowerCase();
    if (rk === 'client' || rk === 'regular_client' || data.entity_type === 'client') {
        redirect(`/${locale}/portal/client`);
    }
}
