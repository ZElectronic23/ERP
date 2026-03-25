import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: req.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return req.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const { data: { session } } = await supabase.auth.getSession();

    const url = req.nextUrl.clone();
    const path = url.pathname;

    const isPublicPath =
        path === '/' ||
        path.startsWith('/login') ||
        path.startsWith('/auth') ||
        path.match(/^\/(ar|en)\/login$/) !== null;

    const isLoggedIn = !!session;

    if (!isLoggedIn && !isPublicPath) {
        const localeMatch = path.match(/^\/(ar|en)\//);
        const locale = localeMatch ? localeMatch[1] : 'ar';
        url.pathname = `/${locale}/login`;
        return NextResponse.redirect(url);
    }

    if (isLoggedIn && (path === '/' || path.startsWith('/login') || path.startsWith('/auth'))) {
        const localeMatch = path.match(/^\/(ar|en)\//);
        const locale = localeMatch ? localeMatch[1] : 'ar';
        url.pathname = `/${locale}/dashboard`;
        return NextResponse.redirect(url);
    }

    return response;
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};