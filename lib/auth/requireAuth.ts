// Server-side auth guards for API routes.
// These read the Supabase session from cookies (set by the browser client),
// so they work in Route Handlers and Server Components.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface AuthedUser {
  id: string;
  email: string | null;
}

export interface UserProfile {
  entity_id: string;
  email: string;
  role_key: string | null;
  is_admin: boolean;
  status: string | null;
}

/** Returns the authenticated auth user from the request cookies, or null. */
export async function getSessionUser(): Promise<AuthedUser | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}

/** Loads the app-level user profile (from the public.users table) for an auth user. */
export async function getUserProfile(user: AuthedUser): Promise<UserProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('entity_id, email, role_key, is_admin, status')
    .eq('entity_id', user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data as UserProfile;
}

/**
 * Guard for API routes that require any signed-in, active user.
 * Returns the user and profile, or null when the caller is not authorized.
 */
export async function requireUser(): Promise<{ user: AuthedUser; profile: UserProfile } | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const profile = await getUserProfile(user);
  if (!profile || profile.status === 'deleted' || profile.status === 'suspended') return null;
  return { user, profile };
}

/**
 * Guard for admin-only API routes.
 * Returns the user and profile only when the caller is an active admin.
 */
export async function requireAdmin(): Promise<{ user: AuthedUser; profile: UserProfile } | null> {
  const authed = await requireUser();
  if (!authed || !authed.profile.is_admin) return null;
  return authed;
}
