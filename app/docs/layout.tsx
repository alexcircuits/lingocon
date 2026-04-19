import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { DocsShell } from "@/components/docs/docs-shell"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Developer docs",
  description:
    "Architecture, codebase layout, database notes, and local development guides for LingoCon contributors.",
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <DocsShell>{children}</DocsShell>
      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  )
}
