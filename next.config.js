/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/ext/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, DELETE, OPTIONS" },
        ],
      },
      {
        // User-uploaded files (flags, covers, fonts, audio, SVGs…). Neutralize
        // stored-content attacks: `nosniff` stops a disguised .txt being read as
        // HTML, and a strict CSP sandbox stops any script/`javascript:` in an
        // uploaded SVG from executing on a direct top-level navigation. Images
        // still load fine via <img> (CSP applies to the document, not subresource
        // loads), so display is unaffected.
        source: "/uploads/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Security-Policy", value: "default-src 'none'; sandbox; style-src 'unsafe-inline'" },
        ],
      },
    ]
  },
  experimental: {
    // Runs instrumentation.ts register() once at server startup (env validation).
    // Stable and flag-free in Next 15+; required on Next 14.
    instrumentationHook: true,
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
    ],
  },
}

const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

module.exports = withNextIntl(nextConfig);
