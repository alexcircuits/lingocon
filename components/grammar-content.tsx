"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { IGT } from "@/lib/tiptap/igt-extension"
import { Paradigm } from "@/lib/tiptap/paradigm-extension"
import { IGTBlock } from "@/components/igt-block"
import { ParadigmEmbed } from "@/components/paradigm-embed"
import { useMemo } from "react"

interface GrammarContentProps {
  content: any // TipTap JSON content
}

export function GrammarContent({ content }: GrammarContentProps) {
  // Ensure content is in the right format for TipTap
  const processedContent = useMemo(() => {
    // If content is a string, wrap it in a proper TipTap JSON structure
    if (typeof content === "string") {
      return {
        type: "doc",
        content: content.split('\n').filter(line => line.trim()).map(line => ({
          type: "paragraph",
          content: [{ type: "text", text: line }]
        }))
      }
    }

    // Ensure content is a valid TipTap JSON object
    if (!content || typeof content !== "object" || !content.type || !Array.isArray(content.content)) {
      return {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [],
          },
        ],
      }
    }

    return content
  }, [content])

  const editor = useEditor({
    extensions: [StarterKit, IGT, Paradigm],
    content: processedContent as any,
    editable: false,
    immediatelyRender: false,
  })

  if (!editor) {
    return <div className="prose prose-slate dark:prose-invert max-w-none">Loading...</div>
  }

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <EditorContent editor={editor} />
    </div>
  )
}

