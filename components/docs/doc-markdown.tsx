"use client"

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
 * Renders repo markdown on the client so tables, GFM, and links work without pulling MDX into the build.
 */
export function DocMarkdown({ content }: DocMarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  )
}
