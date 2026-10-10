const { resolveDistDir } = require("./lib/release-dir.cjs")

/** @type {import('next').NextConfig} */
const nextConfig = {
  // deploy.sh releases vs manual builds: see lib/release-dir.cjs.
  distDir: resolveDistDir({ root: __dirname, argv: process.argv, env: process.env }),
  // The app root, not whichever parent directory happens to hold another lockfile.
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        // The worker script must never be served from an HTTP cache: clients only
        // pick up a fixed worker (e.g. one that stops caching project data) when
        // they re-download this file.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
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
  // instrumentation.ts register() (env validation at startup) runs without a flag since Next 15.
  experimental: {
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
