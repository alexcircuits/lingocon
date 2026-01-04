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
  // Process content to extract IGT nodes and render them separately
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

    const nodes = content.content.map((node: any) => {
      if (node.type === "igt") {
        // Replace IGT node with paragraph placeholder
        return {
          type: "paragraph",
          attrs: { "data-igt-id": node.attrs?.sentence || Math.random() },
        }
      }
      if (node.type === "paradigm") {
        // Replace paradigm node with paragraph placeholder
        return {
          type: "paragraph",
          attrs: { "data-paradigm-id": node.attrs?.paradigmId || Math.random() },
        }
      }
      return node
    })

    return { ...content, content: nodes }
  }, [content])

  const igtNodes = useMemo(() => {
    if (!content || typeof content !== "object" || !Array.isArray(content.content)) return []
    return content.content.filter((node: any) => node.type === "igt")
  }, [content])

  const paradigmNodes = useMemo(() => {
    if (!content || typeof content !== "object" || !Array.isArray(content.content)) return []
    return content.content.filter((node: any) => node.type === "paradigm")
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
      {igtNodes.length > 0 && (
        <div className="mt-6 space-y-4">
          {igtNodes.map((node: any, idx: number) => (
            <IGTBlock
              key={idx}
              sentence={node.attrs?.sentence || ""}
              gloss={node.attrs?.gloss || ""}
              translation={node.attrs?.translation || ""}
              editable={false}
            />
          ))}
        </div>
      )}
      {paradigmNodes.length > 0 && (
        <div className="mt-6 space-y-4">
          {paradigmNodes.map((node: any, idx: number) => (
            <ParadigmEmbed
              key={idx}
              paradigmId={node.attrs?.paradigmId || ""}
              paradigmName={node.attrs?.paradigmName}
            />
          ))}
        </div>
      )}
    </div>
  )
}

