/**
 * Public reader for stored rich text (grammar pages, articles, texts). Server-rendered via
 * TiptapDocument — see components/rich-text/tiptap-document.tsx for why this no longer mounts a
 * read-only TipTap editor.
 */
import { TiptapDocument } from "@/components/rich-text/tiptap-document"

interface GrammarContentProps {
  content: unknown // TipTap JSON content (or a legacy plain string)
  className?: string
  /** Needed to resolve [[wiki-link]] hrefs to /lang/{slug}/grammar/{pageSlug} */
  languageSlug?: string
}

export function GrammarContent({ content, className, languageSlug }: GrammarContentProps) {
  return <TiptapDocument content={content} className={className} languageSlug={languageSlug} />
}
