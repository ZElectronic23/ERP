// Google OAuth callback: verify state, exchange the code, store tokens for the signed-in user.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireUser } from '@/lib/auth/requireAuth';
import { exchangeCode, saveTokens, emailFromIdToken } from '@/lib/googleCalendar';

function originOf(req: Request): string {
    const h = req.headers;
    const proto = h.get('x-forwarded-proto') || 'https';
    const host = h.get('x-forwarded-host') || h.get('host') || '';
    return `${proto}://${host}`;
}

export async function GET(req: Request) {
    const origin = originOf(req);
    const back = (q: string) => NextResponse.redirect(`${origin}/ar/calendar?google=${q}`);

    const authed = await requireUser();
    if (!authed) return NextResponse.redirect(`${origin}/ar/login`);

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const err = url.searchParams.get('error');
    if (err || !code) return back('denied');

    const jar = await cookies();
    const expected = jar.get('gcal_state')?.value;
    if (!expected || expected !== state) return back('bad_state');

    try {
        const tok = await exchangeCode(code, origin);
        await saveTokens(authed.user.id, tok, emailFromIdToken(tok.id_token));
    } catch {
        return back('error');
    }
    const res = back('connected');
    res.cookies.set('gcal_state', '', { maxAge: 0, path: '/' });
    return res;
}
