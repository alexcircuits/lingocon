import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "next-auth/react";

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
    <html lang="en">
      <body className="min-h-screen antialiased">
        <SessionProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: "border-border/50 bg-card shadow-soft",
            }}
          />
        </SessionProvider>
      </body>
    </html>
  );
}
