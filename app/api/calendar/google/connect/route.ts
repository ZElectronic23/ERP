// Start the Google Calendar OAuth consent flow. Signed-in users only.
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireAuth';
import { googleConfigured, buildAuthUrl } from '@/lib/googleCalendar';
import { randomBytes } from 'crypto';

function originOf(req: Request): string {
    const h = req.headers;
    const proto = h.get('x-forwarded-proto') || 'https';
    const host = h.get('x-forwarded-host') || h.get('host') || '';
    return `${proto}://${host}`;
}

export async function GET(req: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const origin = originOf(req);
    if (!googleConfigured()) {
        // not set up yet — bounce back with a clear flag for the UI
        return NextResponse.redirect(`${origin}/ar/calendar?google=not_configured`);
    }
    const state = randomBytes(16).toString('hex');
    const res = NextResponse.redirect(buildAuthUrl(origin, state));
    // short-lived, httpOnly state cookie for CSRF protection on the callback
    res.cookies.set('gcal_state', state, { httpOnly: true, secure: origin.startsWith('https'), sameSite: 'lax', maxAge: 600, path: '/' });
    return res;
}
