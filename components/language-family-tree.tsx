"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { GitBranch, Crown, ChevronRight } from "lucide-react"

interface LanguageNode {
  id: string
  name: string
  slug: string
  _count?: { dictionaryEntries?: number }
  childLanguages?: LanguageNode[]
}

interface LanguageFamilyTreeProps {
  /** The root or any node to show the tree from */
  tree: LanguageNode
  /** Currently viewed language slug (to highlight) */
  currentSlug?: string
  /** Whether links should go to studio or public view */
  linkPrefix?: "studio" | "public"
}

function TreeNode({
  node,
  currentSlug,
  linkPrefix,
  depth = 0,
}: {
  node: LanguageNode
  currentSlug?: string
  linkPrefix?: string
  depth?: number
}) {
  const isCurrent = node.slug === currentSlug
  const hasChildren = node.childLanguages && node.childLanguages.length > 0
  const href =
    linkPrefix === "studio"
      ? `/studio/lang/${node.slug}`
      : `/lang/${node.slug}`

  return (
    <div className="relative">
      {/* Node */}
      <Link
        href={href}
        className={`group flex items-center gap-2 rounded-lg border px-3 py-2 transition-all hover:border-primary/50 hover:shadow-sm ${
          isCurrent
            ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
            : "border-border/50 bg-card hover:bg-muted/30"
        }`}
      >
        {depth === 0 && (
          <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{node.name}</div>
          <div className="text-[11px] text-muted-foreground">/{node.slug}</div>
        </div>
        {node._count?.dictionaryEntries !== undefined && (
          <Badge variant="outline" className="text-[10px] shrink-0 px-1.5 py-0">
            {node._count.dictionaryEntries}
          </Badge>
        )}
      </Link>

      {/* Children */}
      {hasChildren && (
        <div className="ml-4 mt-1.5 pl-4 border-l-2 border-border/30 space-y-1.5">
          {node.childLanguages!.map((child) => (
            <div key={child.id} className="relative">
              <div className="absolute -left-4 top-4 w-4 border-t-2 border-border/30" />
              <div className="flex items-start gap-1.5">
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 mt-3 shrink-0" />
                <TreeNode
                  node={child}
                  currentSlug={currentSlug}
                  linkPrefix={linkPrefix}
                  depth={depth + 1}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function LanguageFamilyTree({
  tree,
  currentSlug,
  linkPrefix = "studio",
}: LanguageFamilyTreeProps) {
  return (
    <div>
      <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
        <GitBranch className="h-4 w-4" />
        Language Family
      </h4>
      <div className="rounded-lg border bg-muted/20 p-3 overflow-x-auto">
        <TreeNode
          node={tree}
          currentSlug={currentSlug}
          linkPrefix={linkPrefix}
        />
      </div>
    </div>
  )
}
