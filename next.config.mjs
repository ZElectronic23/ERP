import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Security headers applied to every response. Deliberately NO Permissions-Policy / CSP here:
// the app legitimately uses camera + microphone (in-app meeting room) and geolocation
// (geofenced attendance), and embeds YouTube/Jitsi — a blanket policy would break those.
const securityHeaders = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },           // stop MIME sniffing
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },               // clickjacking: only we may frame our pages
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
    turbopack: {
        root: '.',
    },
    poweredByHeader: false,                 // don't advertise the framework
    reactStrictMode: true,
    productionBrowserSourceMaps: false,     // don't ship source maps to the browser
    compress: true,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.supabase.co',
            },
        ],
    },
    async headers() {
        return [{ source: '/:path*', headers: securityHeaders }];
    },
};

export default withNextIntl(nextConfig);
