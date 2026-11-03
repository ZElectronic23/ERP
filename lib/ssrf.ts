// SSRF-safe fetch for user-supplied URLs (OWASP A10). Used wherever the server fetches a URL
// that a user can influence (e.g. calendar ICS subscriptions). It:
//   - allows only http/https (webcal:// is normalised to https://),
//   - DNS-resolves the host and refuses any private / loopback / link-local / metadata address,
//   - follows redirects manually, re-validating every hop,
//   - bounds time and redirect count.
// Note: this does not fully defeat DNS-rebinding (the OS may re-resolve at connect time); it
// closes the common SSRF vectors (metadata IPs, localhost, RFC1918, redirects to internal).
import { lookup } from 'dns/promises';
import net from 'net';

function ipIsPrivate(ip: string): boolean {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        if (a === 0 || a === 10 || a === 127) return true;
        if (a === 169 && b === 254) return true;          // link-local incl. 169.254.169.254 metadata
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
        if (a >= 224) return true;                          // multicast / reserved
        return false;
    }
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('::ffff:')) return ipIsPrivate(v.slice(7)); // IPv4-mapped IPv6
    if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true; // link-local / ULA
    return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
    const h = hostname.toLowerCase().replace(/\.$/, '');
    if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) throw new Error('PRIVATE_HOST');
    if (net.isIP(h)) { if (ipIsPrivate(h)) throw new Error('PRIVATE_HOST'); return; }
    let addrs: { address: string }[];
    try { addrs = await lookup(h, { all: true }); } catch { throw new Error('DNS_FAIL'); }
    if (!addrs.length) throw new Error('DNS_FAIL');
    for (const a of addrs) if (ipIsPrivate(a.address)) throw new Error('PRIVATE_HOST');
}

export interface SafeFetchOpts { maxRedirects?: number; timeoutMs?: number; headers?: Record<string, string>; maxBytes?: number; }

export async function safeFetch(rawUrl: string, opts: SafeFetchOpts = {}): Promise<Response> {
    const { maxRedirects = 3, timeoutMs = 6000, headers = {} } = opts;
    let url = (rawUrl || '').trim();
    if (/^webcal:\/\//i.test(url)) url = 'https://' + url.slice(url.indexOf('//') + 2);

    for (let i = 0; i <= maxRedirects; i++) {
        let u: URL;
        try { u = new URL(url); } catch { throw new Error('BAD_URL'); }
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('BAD_SCHEME');
        await assertPublicHost(u.hostname);

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        let res: Response;
        try { res = await fetch(u.toString(), { redirect: 'manual', signal: ctrl.signal, headers }); }
        finally { clearTimeout(timer); }

        if (res.status >= 300 && res.status < 400) {
            const loc = res.headers.get('location');
            if (!loc) throw new Error('BAD_REDIRECT');
            url = new URL(loc, u).toString();   // re-validated on next loop iteration
            continue;
        }
        return res;
    }
    throw new Error('TOO_MANY_REDIRECTS');
}
