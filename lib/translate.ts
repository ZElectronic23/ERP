// Reusable machine-translation service (server-side). Every string is translated once and
// cached in the `translations` table, so repeat requests are instant and free. Default provider
// is MyMemory (free, no API key for low volume); set LIBRETRANSLATE_URL to use a self-hosted
// LibreTranslate instead, or MYMEMORY_EMAIL to raise the free quota. Results are MACHINE
// translations — label them as such; never present them as official/human translations.
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const LANG_NAMES: Record<string, { ar: string; en: string }> = {
    ar: { ar: 'العربية', en: 'Arabic' }, en: { ar: 'الإنجليزية', en: 'English' },
    fr: { ar: 'الفرنسية', en: 'French' }, es: { ar: 'الإسبانية', en: 'Spanish' },
    de: { ar: 'الألمانية', en: 'German' }, tr: { ar: 'التركية', en: 'Turkish' },
    zh: { ar: 'الصينية', en: 'Chinese' }, ru: { ar: 'الروسية', en: 'Russian' },
    ur: { ar: 'الأردية', en: 'Urdu' }, hi: { ar: 'الهندية', en: 'Hindi' },
};
export const TRANSLATE_LANGS = Object.keys(LANG_NAMES);

const hash = (text: string, source: string, target: string) =>
    crypto.createHash('sha1').update(`${source}:${target}:${text}`).digest('hex');

async function providerTranslate(text: string, source: string, target: string): Promise<string> {
    const libre = process.env.LIBRETRANSLATE_URL;
    if (libre) {
        const res = await fetch(`${libre.replace(/\/$/, '')}/translate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: text, source: source === 'auto' ? 'auto' : source, target, format: 'text', api_key: process.env.LIBRETRANSLATE_API_KEY || undefined }),
            signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) throw new Error(`LibreTranslate ${res.status}`);
        const j = await res.json();
        if (!j.translatedText) throw new Error('LibreTranslate: empty');
        return j.translatedText;
    }
    // MyMemory free endpoint (no key). langpair needs an explicit source; default to English.
    const src = source === 'auto' ? 'en' : source;
    const email = process.env.MYMEMORY_EMAIL ? `&de=${encodeURIComponent(process.env.MYMEMORY_EMAIL)}` : '';
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src}|${target}${email}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`MyMemory ${res.status}`);
    const j = await res.json();
    const out = j?.responseData?.translatedText;
    if (!out || /MYMEMORY WARNING|INVALID/i.test(out)) throw new Error('MyMemory: quota or invalid');
    return out as string;
}

export type TResult = { text: string; translated: string; fromCache: boolean; provider: string };

// Translate one string (cache-first). Throws on provider failure so callers can fall back to the
// original text honestly instead of inventing a translation.
export async function translateOne(text: string, target: string, source = 'en'): Promise<TResult> {
    const clean = (text || '').trim();
    if (!clean) return { text, translated: text, fromCache: true, provider: 'none' };
    if (source === target) return { text, translated: text, fromCache: true, provider: 'none' };
    const h = hash(clean, source, target);

    const { data: hit } = await supabaseAdmin.from('translations').select('translated_text, provider').eq('source_hash', h).eq('target_lang', target).maybeSingle();
    if (hit) return { text, translated: hit.translated_text, fromCache: true, provider: hit.provider || 'cache' };

    const provider = process.env.LIBRETRANSLATE_URL ? 'libretranslate' : 'mymemory';
    const translated = await providerTranslate(clean, source, target);
    await supabaseAdmin.from('translations').upsert(
        { source_hash: h, source_lang: source, target_lang: target, source_text: clean.slice(0, 4000), translated_text: translated, provider },
        { onConflict: 'source_hash,target_lang', ignoreDuplicates: true });
    return { text, translated, fromCache: false, provider };
}

// Translate many strings; cache hits are free, misses go one-by-one (respects free-tier limits).
export async function translateMany(texts: string[], target: string, source = 'en'): Promise<string[]> {
    const out: string[] = [];
    for (const t of texts) {
        try { out.push((await translateOne(t, target, source)).translated); }
        catch { out.push(t); } // honest fallback: keep the original on failure
    }
    return out;
}
