// Google Calendar OAuth + read-only event fetch. Activates only when GOOGLE_CLIENT_ID and
// GOOGLE_CLIENT_SECRET are set (in Vercel env + .env.local). Tokens are stored per user in
// google_calendar_tokens and never exposed to the browser. Scope: calendar.readonly.
import { supabaseAdmin } from '@/lib/supabase/admin';

export const GOOGLE_SCOPE = 'openid email https://www.googleapis.com/auth/calendar.readonly';

// Best-effort email from the id_token payload (display only — no verification needed).
export function emailFromIdToken(idToken?: string): string | undefined {
    try {
        if (!idToken) return undefined;
        const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf8'));
        return payload.email;
    } catch { return undefined; }
}
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function googleConfigured(): boolean {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(origin: string): string {
    return `${origin.replace(/\/$/, '')}/api/calendar/google/callback`;
}

export function buildAuthUrl(origin: string, state: string): string {
    const p = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: redirectUri(origin),
        response_type: 'code',
        scope: GOOGLE_SCOPE,
        access_type: 'offline',       // get a refresh token
        include_granted_scopes: 'true',
        prompt: 'consent',            // ensure a refresh token is returned
        state,
    });
    return `${AUTH_URL}?${p.toString()}`;
}

export async function exchangeCode(code: string, origin: string) {
    const body = new URLSearchParams({
        code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri(origin), grant_type: 'authorization_code',
    });
    const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!res.ok) throw new Error('token_exchange_failed');
    return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope: string; token_type: string; id_token?: string }>;
}

async function refresh(refreshToken: string) {
    const body = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken, grant_type: 'refresh_token',
    });
    const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!res.ok) throw new Error('token_refresh_failed');
    return res.json() as Promise<{ access_token: string; expires_in: number; scope?: string; token_type?: string }>;
}

export async function saveTokens(entityId: string, tok: { access_token: string; refresh_token?: string; expires_in: number; scope?: string; token_type?: string }, email?: string) {
    const expiry = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString();
    const row: Record<string, any> = { entity_id: entityId, access_token: tok.access_token, scope: tok.scope, token_type: tok.token_type, expiry, updated_at: new Date().toISOString() };
    if (tok.refresh_token) row.refresh_token = tok.refresh_token;   // only sent on first consent
    if (email) row.google_email = email;
    await supabaseAdmin.from('google_calendar_tokens').upsert(row, { onConflict: 'entity_id' });
}

export async function disconnect(entityId: string) {
    await supabaseAdmin.from('google_calendar_tokens').delete().eq('entity_id', entityId);
}

export async function getConnection(entityId: string): Promise<{ connected: boolean; email?: string }> {
    const { data } = await supabaseAdmin.from('google_calendar_tokens').select('google_email').eq('entity_id', entityId).maybeSingle();
    return data ? { connected: true, email: data.google_email || undefined } : { connected: false };
}

// Returns a valid access token, refreshing if expired. Null if not connected / refresh failed.
async function validAccessToken(entityId: string): Promise<string | null> {
    const { data } = await supabaseAdmin.from('google_calendar_tokens').select('*').eq('entity_id', entityId).maybeSingle();
    if (!data) return null;
    if (data.expiry && new Date(data.expiry).getTime() > Date.now()) return data.access_token;
    if (!data.refresh_token) return null;
    try {
        const r = await refresh(data.refresh_token);
        await saveTokens(entityId, { ...r, refresh_token: undefined });
        return r.access_token;
    } catch { return null; }
}

// Fetch upcoming primary-calendar events as normalized {title,start,end}. Never throws.
export async function fetchGoogleEvents(entityId: string): Promise<{ title: string; start: string; end: string | null }[]> {
    try {
        if (!googleConfigured()) return [];
        const token = await validAccessToken(entityId);
        if (!token) return [];
        const now = new Date().toISOString();
        const p = new URLSearchParams({ timeMin: now, singleEvents: 'true', orderBy: 'startTime', maxResults: '50' });
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${p.toString()}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
        if (!res.ok) return [];
        const j = await res.json();
        return (j.items || []).map((e: any) => ({
            title: (e.summary || '(no title)').slice(0, 160),
            start: e.start?.dateTime || e.start?.date || null,
            end: e.end?.dateTime || e.end?.date || null,
        })).filter((e: any) => e.start);
    } catch { return []; }
}
