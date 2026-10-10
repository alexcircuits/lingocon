"use client"

import dynamic from "next/dynamic"
import { RichTextEditorSkeleton } from "@/components/rich-text/rich-text-editor-skeleton"
import type { RichTextEditorProps } from "@/components/rich-text/rich-text-editor-impl"

export type { RichTextEditorProps }

/**
 * The rich text editor, code-split from the pages that use it. The editor engine (tiptap,
 * ProseMirror and the table/IGT/paradigm extensions) was ~140 kB of first-load JS on every
 * text, article and grammar editor route. The editor never rendered on the server and only
 * appeared after mount anyway (`immediatelyRender: false`), so it now loads in parallel with
 * hydration instead of in front of it; its frame holds the space meanwhile.
 */
const loadEditor = () => import("@/components/rich-text/rich-text-editor-impl").then((m) => m.RichTextEditor)

// Start fetching as soon as a page that renders the editor evaluates this module, rather than
// when React first renders the editor during hydration. A failed prefetch is not lost: the
// render below requests the chunk again and its failure reaches the chunk-error handling.
if (typeof window !== "undefined") void loadEditor().catch(() => undefined)

export const RichTextEditor = dynamic<RichTextEditorProps>(loadEditor, {
    ssr: false,
    loading: RichTextEditorSkeleton,
})
