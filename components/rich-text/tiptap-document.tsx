/**
 * Read-only renderer for stored TipTap/ProseMirror JSON (grammar pages, articles, texts).
 *
 * Public pages used to mount a full non-editable TipTap editor for this, with
 * `immediatelyRender: false` — so the content was absent from the server HTML (invisible to
 * crawlers and blank until hydration) and every reader downloaded the ~250 KB editor bundle.
 * This walks the JSON directly and works in Server Components. Nodes it doesn't know render their
 * children, so an unfamiliar node never drops text.
 */
import type { ReactNode } from "react"
import Link from "next/link"
import { headingId } from "@/lib/utils/tiptap-headings"
import { isSafeHttpUrl } from "@/lib/utils/safe-url"
import { IGTBlock } from "@/components/igt-block"
import { ParadigmEmbed } from "@/components/paradigm-embed"

export interface TiptapMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface TiptapNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  marks?: TiptapMark[]
}

interface RenderContext {
  languageSlug?: string
}

/** Normalizes what the database may hold (legacy plain strings, null, malformed JSON). */
export function normalizeTiptapContent(content: unknown): TiptapNode {
  if (typeof content === "string") {
    return {
      type: "doc",
      content: content
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })),
    }
  }
  if (content && typeof content === "object" && Array.isArray((content as TiptapNode).content)) {
    return content as TiptapNode
  }
  return { type: "doc", content: [] }
}

function plainText(node: TiptapNode): string {
  if (node.type === "text") return node.text ?? ""
  return (node.content ?? []).map(plainText).join("")
}

function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null
  if (href.startsWith("/") && !href.startsWith("//")) return href
  if (href.startsWith("#") || href.startsWith("mailto:")) return href
  return isSafeHttpUrl(href) ? href : null
}

function applyMarks(text: ReactNode, marks: TiptapMark[] | undefined, key: string): ReactNode {
  return (marks ?? []).reduce<ReactNode>((inner, mark, i) => {
    const k = `${key}-m${i}`
    switch (mark.type) {
      case "bold":
        return <strong key={k}>{inner}</strong>
      case "italic":
        return <em key={k}>{inner}</em>
      case "strike":
        return <s key={k}>{inner}</s>
      case "underline":
        return <u key={k}>{inner}</u>
      case "code":
        return <code key={k}>{inner}</code>
      case "customFont":
        return (
          <span key={k} className="font-custom-script" translate="no">
            {inner}
          </span>
        )
      case "link": {
        const href = safeHref(mark.attrs?.href)
        if (!href) return inner
        const external = /^https?:/i.test(href)
        return (
          <a key={k} href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}>
            {inner}
          </a>
        )
      }
      default:
        return inner
    }
  }, text)
}

function cellProps(attrs: Record<string, unknown> | undefined) {
  const colSpan = typeof attrs?.colspan === "number" && attrs.colspan > 1 ? attrs.colspan : undefined
  const rowSpan = typeof attrs?.rowspan === "number" && attrs.rowspan > 1 ? attrs.rowspan : undefined
  return { colSpan, rowSpan }
}

function renderNodes(nodes: TiptapNode[] | undefined, ctx: RenderContext, keyPrefix: string): ReactNode[] {
  return (nodes ?? []).map((node, i) => renderNode(node, ctx, `${keyPrefix}.${i}`))
}

function renderNode(node: TiptapNode, ctx: RenderContext, key: string): ReactNode {
  const children = () => renderNodes(node.content, ctx, key)
  const attrs = node.attrs ?? {}

  switch (node.type) {
    case "doc":
      return <>{children()}</>
    case "text":
      return applyMarks(node.text ?? "", node.marks, key)
    case "paragraph":
      return <p key={key}>{children()}</p>
    case "heading": {
      const level = Math.min(Math.max(Number(attrs.level) || 2, 1), 6)
      const text = plainText(node).trim()
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
      // Same ids the table of contents computes (extractHeadings), so its anchors resolve.
      return (
        <Tag key={key} id={text && level <= 3 ? headingId(text) : undefined}>
          {children()}
        </Tag>
      )
    }
    case "bulletList":
      return <ul key={key}>{children()}</ul>
    case "orderedList": {
      const start = typeof attrs.start === "number" && attrs.start !== 1 ? attrs.start : undefined
      return (
        <ol key={key} start={start}>
          {children()}
        </ol>
      )
    }
    case "listItem":
      return <li key={key}>{children()}</li>
    case "blockquote":
      return <blockquote key={key}>{children()}</blockquote>
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{plainText(node)}</code>
        </pre>
      )
    case "hardBreak":
      return <br key={key} />
    case "horizontalRule":
      return <hr key={key} />
    case "table":
      return (
        <table key={key}>
          <tbody>{children()}</tbody>
        </table>
      )
    case "tableRow":
      return <tr key={key}>{children()}</tr>
    case "tableHeader":
      return (
        <th key={key} {...cellProps(node.attrs)}>
          {children()}
        </th>
      )
    case "tableCell":
      return (
        <td key={key} {...cellProps(node.attrs)}>
          {children()}
        </td>
      )
    case "igt":
      return (
        <div key={key} className="igt-node-view not-prose my-4">
          <IGTBlock
            sentence={String(attrs.sentence ?? "")}
            gloss={String(attrs.gloss ?? "")}
            translation={String(attrs.translation ?? "")}
            editable={false}
          />
        </div>
      )
    case "paradigm":
      return attrs.paradigmId ? (
        <div key={key} className="paradigm-node-view not-prose my-4">
          <ParadigmEmbed paradigmId={String(attrs.paradigmId)} paradigmName={String(attrs.paradigmName ?? "")} />
        </div>
      ) : null
    case "wikiLink": {
      const slug = typeof attrs.slug === "string" ? attrs.slug : ""
      const label = typeof attrs.label === "string" && attrs.label ? attrs.label : slug
      if (!slug) return label
      const href = ctx.languageSlug ? `/lang/${ctx.languageSlug}/grammar/${encodeURIComponent(slug)}` : `#${slug}`
      return (
        <Link
          key={key}
          href={href}
          data-type="wiki-link"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 no-underline transition-colors before:content-['↗'] before:text-[10px] before:opacity-60"
        >
          {label}
        </Link>
      )
    }
    default:
      // Unknown node: keep its text rather than dropping content.
      return node.content ? <span key={key}>{children()}</span> : node.text ?? null
  }
}

export function TiptapDocument({
  content,
  languageSlug,
  className,
}: {
  content: unknown
  languageSlug?: string
  className?: string
}) {
  const doc = normalizeTiptapContent(content)
  return (
    <div
      className={`prose prose-slate dark:prose-invert max-w-none [&_table]:block [&_table]:w-max [&_table]:max-w-none [&_table]:overflow-x-auto ${className ?? ""}`}
    >
      {renderNodes(doc.content, { languageSlug }, "n")}
    </div>
  )
}
