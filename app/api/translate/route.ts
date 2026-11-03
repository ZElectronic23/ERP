// On-demand machine translation for any signed-in user: single text, a batch, or a subtitle
// track (VTT/SRT → translated VTT, timestamps preserved). Cached + free-first (see lib/translate).
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireAuth';
import { translateOne, translateMany, TRANSLATE_LANGS } from '@/lib/translate';
import { parseSubtitles, serializeVtt } from '@/lib/subtitles';

export async function POST(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const b = await request.json().catch(() => ({}));
    const target = String(b.target || '');
    const source = String(b.source || 'en');
    if (!TRANSLATE_LANGS.includes(target)) return NextResponse.json({ error: 'bad_target', message: 'لغة الهدف غير مدعومة.' }, { status: 400 });

    try {
        if (b.action === 'subtitles') {
            const cues = parseSubtitles(String(b.vtt || b.text || ''));
            if (!cues.length) return NextResponse.json({ error: 'no_cues', message: 'تعذّر قراءة الترجمة (VTT/SRT).' }, { status: 400 });
            const translated = await translateMany(cues.map(c => c.text), target, source);
            const out = cues.map((c, i) => ({ ...c, text: translated[i] }));
            return NextResponse.json({ vtt: serializeVtt(out), cueList: out, cues: out.length, machine: true });
        }
        if (b.action === 'batch') {
            const texts = Array.isArray(b.texts) ? b.texts.map((x: any) => String(x)) : [];
            const translations = await translateMany(texts, target, source);
            return NextResponse.json({ translations, machine: true });
        }
        // single text
        const r = await translateOne(String(b.text || ''), target, source);
        return NextResponse.json({ translated: r.translated, provider: r.provider, fromCache: r.fromCache, machine: true });
    } catch (e: any) {
        // honest failure — do not fabricate a translation
        return NextResponse.json({ error: 'provider_unavailable', message: 'خدمة الترجمة غير متاحة حالياً — حاول لاحقاً أو اضبط مزوّداً (LibreTranslate).' }, { status: 503 });
    }
}
