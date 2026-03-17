"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { GitBranch, Crown, ChevronRight, ChevronDown, Share2, Check, Maximize2, Minimize2 } from "lucide-react"

interface LanguageNode {
  id: string
  name: string
  slug: string
  externalAncestry?: string | null
  owner?: { id: string; name: string | null; image: string | null }
  _count?: { dictionaryEntries?: number }
  childLanguages?: LanguageNode[]
  isVirtual?: boolean
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
  lineagePath,
  expandAction,
  collapseAction,
}: {
  node: LanguageNode
  currentSlug?: string
  linkPrefix?: string
  depth?: number
  lineagePath?: string[]
  expandAction?: number
  collapseAction?: number
}) {
  const isCurrent = node.slug === currentSlug
  const inLineage = lineagePath?.includes(node.id)
  const isLineageParent = inLineage && !isCurrent

  const hasChildren = node.childLanguages && node.childLanguages.length > 0
  const sortedChildren = hasChildren
    ? [...node.childLanguages!].sort((a, b) => a.name.localeCompare(b.name))
    : []
  const href =
    linkPrefix === "studio"
      ? `/studio/lang/${node.slug}`
      : `/lang/${node.slug}`

  // Collapse/expand: default expanded for lineage, shallow trees
  const [isExpanded, setIsExpanded] = useState(inLineage || depth < 3)

  useEffect(() => {
    if (expandAction && expandAction > 0) setIsExpanded(true)
  }, [expandAction])

  useEffect(() => {
    if (collapseAction && collapseAction > 0) setIsExpanded(false)
  }, [collapseAction])

  if (node.isVirtual) {
    return (
      <div className="relative">
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 bg-background/50 px-3 py-2 mb-2 w-fit">
          {hasChildren && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <div className="font-medium text-sm truncate italic text-muted-foreground">
            {node.name}
          </div>
          {hasChildren && !isExpanded && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">
              {sortedChildren.length}
            </Badge>
          )}
        </div>
        
        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="ml-2 sm:ml-4 mt-1.5 pl-2 sm:pl-4 border-l-2 border-border/30 space-y-1 sm:space-y-1.5">
            {sortedChildren.map((child) => (
              <div key={child.id} className="relative">
                <div className="absolute -left-4 top-4 w-4 border-t-2 border-border/30" />
                <div className="flex items-start gap-1.5">
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50 mt-3 shrink-0" />
                  <TreeNode
                    node={child}
                    currentSlug={currentSlug}
                    linkPrefix={linkPrefix}
                    depth={depth + 1}
                    lineagePath={lineagePath}
                    expandAction={expandAction}
                    collapseAction={collapseAction}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Node */}
      <div className="flex items-center gap-1.5">
        {hasChildren && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted/50 -ml-1"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        <Link
          href={href}
          className={`group flex flex-1 flex-col md:flex-row md:items-center gap-2 rounded-lg border px-3 py-2 transition-all hover:border-primary/50 hover:shadow-sm ${
            isCurrent
              ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
              : isLineageParent
              ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
              : "border-border/50 bg-card hover:bg-muted/30"
          }`}
        >
          {depth === 0 && (
            <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0 hidden md:block" />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate flex flex-wrap items-center gap-2">
              {node.name}
              {node.owner && (
                 <div className="flex items-center gap-1 text-[10px] bg-secondary px-1.5 py-0.5 rounded-sm font-normal text-muted-foreground w-fit shrink-0">
                   {node.owner.image ? (
                     <img src={node.owner.image} alt="" className="w-3 h-3 rounded-full object-cover" />
                   ) : (
                     <div className="w-3 h-3 rounded-full bg-primary/20 flex items-center justify-center text-[7px] font-bold text-primary">
                       {node.owner.name?.[0]?.toUpperCase() || "?"}
                     </div>
                   )}
                   <span className="truncate max-w-[80px]">{node.owner.name || "User"}</span>
                 </div>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">/{node.slug}</div>
          </div>
          {node._count?.dictionaryEntries !== undefined && (
            <Badge variant="outline" className="text-[10px] shrink-0 px-1.5 py-0 w-fit">
              {node._count.dictionaryEntries}
            </Badge>
          )}
          {hasChildren && !isExpanded && (
            <Badge variant="outline" className="text-[9px] shrink-0 px-1 py-0 w-fit bg-muted/50">
              +{sortedChildren.length}
            </Badge>
          )}
        </Link>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="ml-2 sm:ml-4 mt-1.5 pl-2 sm:pl-4 border-l-2 border-border/30 space-y-1 sm:space-y-1.5">
          {sortedChildren.map((child) => (
            <div key={child.id} className="relative">
              <div className="absolute -left-4 top-4 w-4 border-t-2 border-border/30" />
              <div className="flex items-start gap-1.5">
                <TreeNode
                  node={child}
                  currentSlug={currentSlug}
                  linkPrefix={linkPrefix}
                  depth={depth + 1}
                  lineagePath={lineagePath}
                  expandAction={expandAction}
                  collapseAction={collapseAction}
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
  const [copied, setCopied] = useState(false)
  const [expandAction, setExpandAction] = useState(0)
  const [collapseAction, setCollapseAction] = useState(0)

  // Compute the lineage path from root to current language
  const lineagePath = useMemo(() => {
    if (!currentSlug) return []
    const findPath = (n: LanguageNode, targetSlug: string, path: string[]): string[] | null => {
      const p = [...path, n.id]
      if (n.slug === targetSlug) return p
      if (n.childLanguages) {
        for (const child of n.childLanguages) {
          const res = findPath(child, targetSlug, p)
          if (res) return res
        }
      }
      return null
    }
    return findPath(tree, currentSlug, []) || []
  }, [tree, currentSlug])

  const handleShare = async () => {
    const slug = currentSlug || tree.slug
    const url = `${window.location.origin}/lang/${slug}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      window.open(url, "_blank")
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Language Family
        </h4>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExpandAction(a => a + 1)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
              title="Expand All"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCollapseAction(a => a + 1)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
              title="Collapse All"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
          >
            {copied ? (
              <><Check className="h-3 w-3 text-emerald-500" /> Copied!</>
            ) : (
              <><Share2 className="h-3 w-3" /> Share</>
            )}
          </button>
      </div>
      <div className="rounded-lg border bg-muted/20 p-2 sm:p-3 overflow-x-auto min-w-0">
        {tree.externalAncestry && !tree.isVirtual && (
          <div className="relative mb-4">
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 bg-background/50 px-3 py-2 w-fit">
              <div className="font-medium text-sm truncate italic text-muted-foreground">
                {tree.externalAncestry}
              </div>
            </div>
            <div className="absolute left-6 h-4 w-px bg-border/40 bottom-[-16px]" />
          </div>
        )}
        <TreeNode
          node={tree}
          currentSlug={currentSlug}
          linkPrefix={linkPrefix}
          lineagePath={lineagePath}
          expandAction={expandAction}
          collapseAction={collapseAction}
        />
      </div>
    </div>
  )
}
