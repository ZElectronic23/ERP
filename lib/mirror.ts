// Server-side content mirror ("dropshipping" model for courses).
//
// Providers like IBM SkillsBuild / Cisco NetAcad / HP send X-Frame-Options so their
// pages render BLANK inside an <iframe>. Instead we fetch their PUBLIC pages server-side
// and re-render a clean reader view inside the ERP shell — so the user never leaves.
//
// Scope & ethics: this mirrors only PUBLICLY accessible pages (course overviews, syllabi,
// catalog listings — no login). We never rehost login-gated proprietary video or labs;
// that would be piracy. The reader view keeps attribution to the source.
//
// Security (OWASP SSRF, A10): the URL is restricted to an allow-list of known public
// learning domains, redirects are followed manually and re-checked against the list,
// raw IP / private hosts are refused, the response is size- and time-bounded, and only
// text is extracted (all scripts, styles, iframes and event handlers are stripped).

// Allowed registrable domains (suffix match: `netacad.com` also allows `www.netacad.com`).
export const MIRROR_HOSTS = [
    'skillsbuild.org', 'ibm.com',
    'netacad.com', 'cisco.com', 'skillsforall.com',
    'hp.com', 'hpe.com', 'hp.life', 'life-global.org',
    'coursera.org', 'edx.org', 'freecodecamp.org',
    'microsoft.com', 'learn.microsoft.com',
    'developer.mozilla.org', 'mozilla.org',
    'w3schools.com', 'geeksforgeeks.org',
];

const MAX_BYTES = 3_000_000;   // 3 MB cap on the fetched document
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 12_000;

export function hostAllowed(host: string): boolean {
    const h = host.toLowerCase().replace(/\.$/, '');
    return MIRROR_HOSTS.some(d => h === d || h.endsWith('.' + d));
}

// Refuse raw IPs and obvious private / loopback / link-local hosts (defence in depth;
// the allow-list already excludes these, but a redirect could try to sneak one in).
function hostIsPrivate(host: string): boolean {
    const h = host.toLowerCase();
    if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
    // IPv4 literal?
    const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (m) {
        const [a, b] = [Number(m[1]), Number(m[2])];
        if (a === 10 || a === 127 || a === 0) return true;
        if (a === 169 && b === 254) return true;            // link-local
        if (a === 192 && b === 168) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a >= 224) return true;                           // multicast / reserved
        return false;                                        // some other public IPv4 literal — still refuse below
    }
    if (h.includes(':')) return true;                        // IPv6 literal — refuse
    return false;
}

export interface MirrorResult {
    ok: boolean;
    url: string;
    finalUrl: string;
    site: string;
    title: string;
    description: string;
    blocks: { t: 'h' | 'p' | 'li'; text: string }[];
    note?: string;
}

function validate(raw: string): URL {
    let u: URL;
    try { u = new URL(raw); } catch { throw new Error('BAD_URL'); }
    if (u.protocol !== 'https:') throw new Error('HTTPS_ONLY');
    if (hostIsPrivate(u.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) throw new Error('PRIVATE_HOST');
    if (!hostAllowed(u.hostname)) throw new Error('HOST_NOT_ALLOWED');
    return u;
}

// Fetch following redirects manually, re-validating every hop against the allow-list.
async function fetchFollowing(start: URL): Promise<{ html: string; finalUrl: string }> {
    let current = start;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        let res: Response;
        try {
            res = await fetch(current.toString(), {
                redirect: 'manual',
                signal: ctrl.signal,
                headers: { 'User-Agent': 'Mozilla/5.0 (ZElectronic-ERP course reader)', 'Accept': 'text/html,*/*' },
            });
        } finally { clearTimeout(timer); }

        if (res.status >= 300 && res.status < 400) {
            const loc = res.headers.get('location');
            if (!loc) throw new Error('BAD_REDIRECT');
            current = validate(new URL(loc, current).toString());   // re-check the new target
            continue;
        }
        if (!res.ok) throw new Error('HTTP_' + res.status);
        const ctype = res.headers.get('content-type') || '';
        if (!/text\/html|application\/xhtml/i.test(ctype)) throw new Error('NOT_HTML');

        // read with a hard byte cap
        const reader = res.body?.getReader();
        if (!reader) { return { html: await res.text(), finalUrl: current.toString() }; }
        const chunks: Uint8Array[] = []; let total = 0;
        for (; ;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) { total += value.length; chunks.push(value); if (total > MAX_BYTES) { reader.cancel(); break; } }
        }
        const buf = new Uint8Array(total > MAX_BYTES ? MAX_BYTES : total);
        let off = 0; for (const c of chunks) { if (off + c.length > buf.length) { buf.set(c.subarray(0, buf.length - off), off); break; } buf.set(c, off); off += c.length; }
        return { html: new TextDecoder('utf-8').decode(buf), finalUrl: current.toString() };
    }
    throw new Error('TOO_MANY_REDIRECTS');
}

const decodeEntities = (s: string) => s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ''; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ''; } });

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// Extract a readable outline from raw HTML using tag scanning (no DOM / no deps).
function extractReadable(html: string, url: string): MirrorResult {
    const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();

    // drop everything that is not readable content
    let body = html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script\b[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
        .replace(/<(nav|footer|header|aside|form|svg|iframe|template)\b[\s\S]*?<\/\1>/gi, '');

    const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const title = stripTags(ogTitle?.[1] || titleM?.[1] || '').slice(0, 200);

    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const description = stripTags(metaDesc?.[1] || '').slice(0, 500);

    const blocks: MirrorResult['blocks'] = [];
    const seen = new Set<string>();
    const push = (t: 'h' | 'p' | 'li', raw: string) => {
        const text = stripTags(raw);
        if (text.length < 2 || text.length > 1500) return;
        const key = t + '|' + text.toLowerCase();
        if (seen.has(key)) return; seen.add(key);
        blocks.push({ t, text });
    };

    // walk headings, paragraphs and list items in document order
    const re = /<(h[1-4]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(body)) && blocks.length < 400) {
        const tag = mm[1].toLowerCase();
        push(tag[0] === 'h' ? 'h' : tag === 'li' ? 'li' : 'p', mm[2]);
    }

    return {
        ok: blocks.length > 0 || !!description,
        url, finalUrl: url, site: host, title, description, blocks,
    };
}

/** Mirror a public provider page into a clean reader structure. Throws on policy/fetch errors. */
export async function mirrorPage(raw: string): Promise<MirrorResult> {
    const u = validate(raw);
    const { html, finalUrl } = await fetchFollowing(u);
    const out = extractReadable(html, finalUrl);
    out.url = raw; out.finalUrl = finalUrl;
    if (!out.ok) out.note = 'EMPTY';
    return out;
}
