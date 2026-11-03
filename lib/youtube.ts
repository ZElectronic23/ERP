// White-label course import: pull a PUBLIC YouTube playlist (or single video / channel uploads)
// from the source and turn it into our own video lessons. We store only the video reference and
// title — the video itself streams from YouTube inside our player, so nothing is re-hosted.
//
// No API key (free): we fetch the public page server-side and read its embedded `ytInitialData`
// JSON. Host is fixed to youtube.com, so there is no SSRF surface. Time- and size-bounded.

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 4_000_000;

export interface YtVideo { videoId: string; title: string; }
export interface YtParsed { type: 'playlist' | 'video' | 'channel' | 'unknown'; id: string; }

export function parseYouTube(raw: string): YtParsed {
    const s = (raw || '').trim();
    try {
        const u = new URL(s.startsWith('http') ? s : `https://${s}`);
        const host = u.hostname.replace(/^www\./, '');
        if (!/(^|\.)youtube\.com$/.test(host) && host !== 'youtu.be') return { type: 'unknown', id: '' };
        const list = u.searchParams.get('list'); if (list) return { type: 'playlist', id: list };
        if (host === 'youtu.be') { const id = u.pathname.slice(1).split('/')[0]; if (id) return { type: 'video', id }; }
        const v = u.searchParams.get('v'); if (v) return { type: 'video', id: v };
        const emb = u.pathname.match(/\/embed\/([\w-]{11})/); if (emb) return { type: 'video', id: emb[1] };
        if (/\/(channel|c|user)\//.test(u.pathname) || u.pathname.startsWith('/@')) return { type: 'channel', id: u.pathname };
        return { type: 'unknown', id: '' };
    } catch {
        if (/^[\w-]{11}$/.test(s)) return { type: 'video', id: s };
        if (/^PL[\w-]+$/.test(s) || /^(UU|FL|LL|RD)[\w-]+$/.test(s)) return { type: 'playlist', id: s };
        return { type: 'unknown', id: '' };
    }
}

async function getText(url: string): Promise<string> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en' } });
        if (!res.ok) throw new Error('HTTP_' + res.status);
        const reader = res.body?.getReader();
        if (!reader) return await res.text();
        const chunks: Uint8Array[] = []; let total = 0;
        for (; ;) { const { done, value } = await reader.read(); if (done) break; if (value) { total += value.length; chunks.push(value); if (total > MAX_BYTES) { reader.cancel(); break; } } }
        return new TextDecoder('utf-8').decode(Buffer.concat(chunks.map(c => Buffer.from(c))));
    } finally { clearTimeout(timer); }
}

// Extract the `ytInitialData = {...}` object via brace matching (string-aware).
function extractInitialData(html: string): any | null {
    for (const marker of ['ytInitialData = ', 'ytInitialData"] = ', 'var ytInitialData = ']) {
        const at = html.indexOf(marker);
        if (at === -1) continue;
        const i = html.indexOf('{', at); if (i === -1) continue;
        let depth = 0, inStr = false, esc = false;
        for (let j = i; j < html.length; j++) {
            const ch = html[j];
            if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
            if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(html.slice(i, j + 1)); } catch { return null; } } }
        }
    }
    return null;
}

// Recursively collect {videoId, title} in document order, de-duped. Handles both the current
// `lockupViewModel` layout and the older `playlistVideoRenderer` one.
function collectVideos(node: any, out: YtVideo[], seen: Set<string>) {
    if (!node || typeof node !== 'object' || out.length >= 300) return;
    if (Array.isArray(node)) { for (const n of node) collectVideos(n, out, seen); return; }
    const push = (id: any, title: any) => {
        if (typeof id === 'string' && /^[\w-]{11}$/.test(id) && !seen.has(id) && title) {
            seen.add(id); out.push({ videoId: id, title: String(title).slice(0, 300) });
        }
    };
    // current layout: lockupViewModel (video cards)
    const lm = node.lockupViewModel;
    if (lm && lm.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') {
        push(lm.contentId, lm.metadata?.lockupMetadataViewModel?.title?.content);
    }
    // legacy layout: videoId with a sibling title
    push(node.videoId, node.title?.runs?.[0]?.text || node.title?.simpleText || node.headline?.simpleText);
    for (const k in node) collectVideos(node[k], out, seen);
}

/** Fetch the ordered videos of a public playlist. Throws on fetch error; returns [] if none found. */
export async function fetchPlaylistVideos(playlistId: string): Promise<{ title: string; videos: YtVideo[] }> {
    const html = await getText(`https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}&hl=en`);
    const data = extractInitialData(html);
    const videos: YtVideo[] = [];
    if (data) collectVideos(data, videos, new Set());
    // playlist title from og:title or the header
    const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/);
    const title = (og?.[1] || 'Imported playlist').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    return { title, videos };
}

/** Title for a single video via oEmbed (no key). */
export async function fetchVideoTitle(videoId: string): Promise<string> {
    try {
        const t = await getText(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        const j = JSON.parse(t); return String(j.title || '').slice(0, 300);
    } catch { return ''; }
}
