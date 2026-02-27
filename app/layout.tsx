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
  keywords: ["conlang", "constructed language", "linguistics", "language documentation", "conlang platform", "worldbuilding", "lexicon builder", "grammar wiki"],
  authors: [{ name: "LingoCon" }],
  creator: "LingoCon",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "LingoCon",
    title: "LingoCon — Document Your Constructed Languages",
    description: "The professional toolkit for language construction. Define grammar, build structured dictionaries, and visualize your syntax.",
  },
  twitter: {
    card: "summary_large_image",
    title: "LingoCon — Document Your Constructed Languages",
    description: "The professional toolkit for language construction. Define grammar, build structured dictionaries, and visualize your syntax.",
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
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
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
      </body>
    </html>
  );
}

