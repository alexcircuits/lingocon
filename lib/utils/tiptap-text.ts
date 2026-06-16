/**
 * Extracts plain text from TipTap/ProseMirror JSON document.
 * Used for server-side grammar page search.
 */

interface TipTapNode {
    type: string
    text?: string
    content?: TipTapNode[]
    attrs?: Record<string, unknown>
}

export function extractText(node: unknown): string {
    if (!node || typeof node !== "object") return ""

    const n = node as TipTapNode

    if (n.type === "text" && typeof n.text === "string") {
        return n.text
    }

    if (Array.isArray(n.content)) {
        const parts: string[] = []
        for (const child of n.content) {
            const text = extractText(child)
            if (text) parts.push(text)
        }
        // Join block-level nodes with spaces, inline with nothing. "doc" is the
        // ProseMirror root container — its block children (paragraphs, headings,
        // …) must be space-separated too, or sibling blocks mash together
        // ("First" + "Second" → "FirstSecond") and break search tokenization.
        const blockTypes = new Set(["doc", "paragraph", "heading", "blockquote", "listItem", "bulletList", "orderedList", "codeBlock"])
        return n.type && blockTypes.has(n.type)
            ? parts.join(" ")
            : parts.join("")
    }

    return ""
}

export function documentToPlainText(content: unknown): string {
    return extractText(content).replace(/\s+/g, " ").trim()
}
