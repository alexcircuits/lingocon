import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: {
    default: "LingoCon — Document Your Constructed Languages",
    template: "%s | LingoCon",
  },
  description: "The platform for conlang creators. Build lexicons, write grammar documentation, and share your constructed languages with the world.",
  keywords: ["conlang", "constructed language", "linguistics", "language documentation", "conlang platform"],
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
