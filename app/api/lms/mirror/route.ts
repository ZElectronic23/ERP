// POST /api/lms/mirror  — re-render a provider's PUBLIC course page inside the ERP.
// Signed-in users only. SSRF-guarded, allow-listed hosts only (see lib/mirror).
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireAuth';
import { mirrorPage } from '@/lib/mirror';

const MSG: Record<string, [string, string]> = {
    BAD_URL: ['رابط غير صالح.', 'Invalid URL.'],
    HTTPS_ONLY: ['يُسمح بروابط HTTPS فقط.', 'Only HTTPS links are allowed.'],
    PRIVATE_HOST: ['عنوان غير مسموح.', 'Address not allowed.'],
    HOST_NOT_ALLOWED: ['هذا المزوّد غير مُدرَج للعرض الداخلي بعد.', 'This provider is not enabled for in-app reading yet.'],
    NOT_HTML: ['تعذّر قراءة الصفحة كنص.', 'The page could not be read as a document.'],
    EMPTY: ['لم نستطع استخراج محتوى قابل للقراءة من هذه الصفحة.', 'No readable content could be extracted from this page.'],
};

export async function POST(req: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    let url = '';
    try { url = (await req.json())?.url || ''; } catch { /* ignore */ }
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

    try {
        const result = await mirrorPage(url);
        if (!result.ok) return NextResponse.json({ error: 'EMPTY', message: MSG.EMPTY, result }, { status: 422 });
        return NextResponse.json(result);
    } catch (e: any) {
        const code = String(e?.message || 'ERR');
        const msg = MSG[code];
        // Network / timeout / blocked by provider — honest failure, no fabrication.
        if (msg) return NextResponse.json({ error: code, message: msg }, { status: code === 'HOST_NOT_ALLOWED' ? 403 : 400 });
        return NextResponse.json({
            error: code,
            message: ['تعذّر جلب الصفحة من المزوّد (قد يكون المزوّد يمنع ذلك). اعتمد على الدروس والتقييم الداخلي.',
                'Could not fetch the page from the provider (they may block it). Rely on the in-app lessons and assessment.'],
        }, { status: 502 });
    }
}
