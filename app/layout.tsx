/**
 * Root layout for the entire App Router tree: global styles, theme + session providers, toast host,
 * achievement listener, and service worker registration (production only — dev unregisters SWs
 * to protect Fast Refresh).
 */
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AchievementListener } from "@/components/achievement-listener";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";


const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lingocon.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LingoCon — Document Your Constructed Languages",
    template: "%s | LingoCon",
  },
  description: "The platform for conlang creators. Build lexicons, write grammar documentation, and share your constructed languages with the world.",
  keywords: [
    // Primary target keywords
    "conlang", "conlang tools", "conlang maker", "conlang builder", "conlang creator", "conlang platform", "conlang software",
    // Constructed language variants
    "constructed language", "constructed language maker", "constructed language builder", "constructed language tools", "invented language", "artificial language", "fictional language",
    // Action-oriented
    "create a conlang", "how to create a conlang", "language creation", "language design", "language invention", "make a language",
    // Feature keywords
    "lexicon builder", "grammar documentation", "phonology builder", "morphology tables", "IPA dictionary", "conlang dictionary", "grammar wiki",
    // Community & sharing
    "conlang community", "share conlang", "conlang documentation",
    // Adjacent use cases
    "worldbuilding language", "worldbuilding tools", "fictional language creator", "language inventor", "linguistics documentation",
  ],
  authors: [{ name: "LingoCon" }, { name: "Alexander Chepkov" }],
  creator: "Alexander Chepkov",
  category: "Language Tools",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "LingoCon",
    title: "LingoCon — The #1 Platform for Conlang Creators",
    description: "The most complete conlang tool available. Build structured lexicons, write grammar documentation, design custom scripts, and share your constructed languages with the world.",
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "LingoCon — The platform for conlang creators",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LingoCon — The #1 Platform for Conlang Creators",
    description: "The most complete conlang tool available. Build lexicons, grammar docs, custom scripts, and share your constructed languages.",
    images: [`${siteUrl}/og-image.png`],
  },
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LingoCon",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#267a6e" />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            {children}
            <AchievementListener />
            <Toaster
              position="bottom-right"
              toastOptions={{
                className: "border-border/50 bg-card shadow-soft",
              }}
            />
          </SessionProvider>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                if ('${process.env.NODE_ENV}' === 'production') {
                  window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js').catch(() => {});
                  });
                } else {
                  // In development mode, unregister any existing service workers
                  // to prevent them from aggressively caching Webpack HMR chunks
                  // and causing "originalFactory is undefined" errors.
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for(let registration of registrations) {
                      registration.unregister();
                    }
                  });
                }
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

