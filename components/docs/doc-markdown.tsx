import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { resolveInternalDocHref } from "@/lib/docs/site-docs"
import type { Components } from "react-markdown"

type DocMarkdownProps = {
  content: string
}

const markdownComponents: Components = {
  a({ href, children }) {
    const target = resolveInternalDocHref(href ?? undefined)
    if (!target) {
      return <span>{children}</span>
    }
    if (target.startsWith("http")) {
      return (
        <a href={target} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">
          {children}
        </a>
      )
    }
    return (
      <Link href={target} className="text-primary underline-offset-4 hover:underline">
        {children}
      </Link>
    )
  },
}

/**
 * Renders markdown (GFM tables, links) without pulling MDX into the build. A server component:
 * it has no client behaviour, so the parser and its plugins never ship to the browser (they
 * were ~43 kB of first-load JS on module and doc pages). Raw HTML stays disabled, as before.
 */
export function DocMarkdown({ content }: DocMarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  )
}
