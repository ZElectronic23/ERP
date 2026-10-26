import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

export async function proxy(req: NextRequest) {
    const url = req.nextUrl.clone();
    const path = url.pathname;

    // Supabase auth check
    let response = NextResponse.next({ request: { headers: req.headers } });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => req.cookies.getAll(),
                setAll: (cookiesToSet) => {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const { data: { session } } = await supabase.auth.getSession();
    const isLoggedIn = !!session;

    const isPublicPath =
        path === '/' ||
        path.startsWith('/login') ||
        path.startsWith('/auth') ||
        /^\/(ar|en)\/login$/.test(path);

    if (!isLoggedIn && !isPublicPath) {
        const locale = path.match(/^\/(ar|en)\//)?.[1] ?? 'ar';
        url.pathname = `/${locale}/login`;
        return NextResponse.redirect(url);
    }

    if (isLoggedIn && (path === '/' || path.startsWith('/login') || path.startsWith('/auth'))) {
        const locale = path.match(/^\/(ar|en)\//)?.[1] ?? 'ar';
        url.pathname = `/${locale}/dashboard`;
        return NextResponse.redirect(url);
    }

    // Handle i18n routing
    return handleI18nRouting(req);
}

export const config = {
    matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
