"use client"

import { useRef, useEffect, useState, useMemo, useCallback } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Search, Focus, ZoomIn, ZoomOut, Maximize } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AuroraBackground } from "@/components/landing/aurora-background"
import {
  buildFamilyGraph,
  resolveFamilies,
  AURORA_FAMILY_COLORS,
  type FamilyLanguageData,
} from "@/lib/utils/family-graph-core"

// The force-graph engine touches `window` on import, so it must never run on
// the server. Dynamically import with ssr:false; the wrapper component still
// renders a placeholder during SSR.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
}) as any

export interface LanguageData {
  id: string
  name: string
  slug: string
  flagUrl: string | null
  parentLanguageId: string | null
  externalAncestry?: string | null
  familyId?: string | null
  family?: { id: string; name: string } | null
  owner: { name: string | null }
  _count: { dictionaryEntries: number }
}

interface GraphNode {
  id: string
  name: string
  slug: string
  isVirtual: boolean
  flagUrl: string | null
  count: number
  familySize: number
  familyLabel: string
  fromFamily: boolean
  color: string
  ownerName: string | null
  radius: number
  // Mutated by the force engine
  x?: number
  y?: number
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  color: string
  dashed: boolean
}

function hslVar(el: HTMLElement, name: string, fallback: string): string {
  const raw = getComputedStyle(el).getPropertyValue(name).trim()
  return raw ? `hsl(${raw})` : fallback
}

export function LingoConUniverseMap({ languages }: { languages: LanguageData[] }) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // ── Build graph data from the SHARED source of truth ──────────────────────
  const { nodes, links } = useMemo(() => {
    const input: FamilyLanguageData[] = languages.map((l) => ({
      id: l.id,
      name: l.name,
      slug: l.slug,
      parentLanguageId: l.parentLanguageId,
      externalAncestry: l.externalAncestry ?? null,
      familyId: l.familyId ?? null,
      family: l.family ?? null,
      _count: l._count,
    }))

    // Display-only metadata kept out of the graph type, looked up by id.
    const meta = new Map(
      languages.map((l) => [
        l.id,
        { flagUrl: l.flagUrl, ownerName: l.owner?.name ?? null },
      ])
    )

    const graph = buildFamilyGraph(input)
    const resolved = resolveFamilies(graph)

    // Subtree sizes (descendant counts) for node sizing + tooltips
    const sizeCache = new Map<string, number>()
    const subtreeSize = (id: string): number => {
      if (sizeCache.has(id)) return sizeCache.get(id)!
      let size = 0
      for (const kid of graph.childrenMap.get(id) || []) {
        size += 1 + subtreeSize(kid)
      }
      sizeCache.set(id, size)
      return size
    }

    const nodes: GraphNode[] = []
    graph.byId.forEach((lang, id) => {
      const fam = resolved.get(id)
      const familySize = subtreeSize(id)
      const count = lang._count?.dictionaryEntries ?? 0
      const radius = lang.isVirtual
        ? 13 + Math.min(11, Math.log10(Math.max(1, familySize)) * 7)
        : 6 +
          Math.max(0, Math.log10(Math.max(1, count)) * 4) +
          Math.min(7, familySize)

      const m = meta.get(id)
      nodes.push({
        id,
        name: lang.name,
        slug: lang.slug,
        isVirtual: !!lang.isVirtual,
        flagUrl: m?.flagUrl ?? null,
        count,
        familySize,
        familyLabel: fam?.label ?? lang.name,
        fromFamily: fam?.fromFamily ?? false,
        color: fam?.color ?? AURORA_FAMILY_COLORS[0],
        ownerName: m?.ownerName ?? null,
        radius,
      })
    })

    const links: GraphLink[] = []
    graph.childrenMap.forEach((kids, parentId) => {
      const parent = graph.byId.get(parentId)
      kids.forEach((kid) => {
        const fam = resolved.get(kid)
        links.push({
          source: parentId,
          target: kid,
          color: fam?.color ?? AURORA_FAMILY_COLORS[0],
          dashed: !!parent?.isVirtual,
        })
      })
    })

    return { nodes, links }
  }, [languages])

  const graphData = useMemo(() => ({ nodes, links }), [nodes, links])

  // ── Search matching (precomputed; read from a ref inside paint) ────────────
  const matchingIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    return new Set(
      nodes.filter((n) => n.name.toLowerCase().includes(q)).map((n) => n.id)
    )
  }, [searchQuery, nodes])
  const matchingIdsRef = useRef<Set<string> | null>(null)
  useEffect(() => {
    matchingIdsRef.current = matchingIds
    fgRef.current?.refresh?.()
  }, [matchingIds])

  const matchCount = matchingIds?.size ?? 0

  // ── Theme-aware label colors (read CSS vars, refresh on palette/theme) ─────
  const fgColorRef = useRef("#1e1b2e")
  const bgColorRef = useRef("#ffffff")
  useEffect(() => {
    const root = document.documentElement
    const sync = () => {
      fgColorRef.current = hslVar(root, "--foreground", "#1e1b2e")
      bgColorRef.current = hslVar(root, "--background", "#ffffff")
      fgRef.current?.refresh?.()
    }
    sync()
    const mo = new MutationObserver(sync)
    mo.observe(root, { attributes: true, attributeFilter: ["class", "data-palette"] })
    return () => mo.disconnect()
  }, [])

  // ── Flag image cache ───────────────────────────────────────────────────────
  const flagCache = useRef(new Map<string, HTMLImageElement>())
  useEffect(() => {
    nodes.forEach((node) => {
      if (node.flagUrl && !flagCache.current.has(node.flagUrl)) {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = node.flagUrl
        img.onload = () => fgRef.current?.refresh?.()
        flagCache.current.set(node.flagUrl, img)
      }
    })
  }, [nodes])

  // ── Resize observer → drive the canvas pixel size ─────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () =>
      setDimensions({ width: el.clientWidth, height: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Tune forces once the engine is available ──────────────────────────────
  const didConfigureRef = useRef(false)
  const configureForces = useCallback(() => {
    if (didConfigureRef.current) return
    const fg = fgRef.current
    if (!fg) return
    didConfigureRef.current = true
    fg.d3Force("charge")?.strength(-180).distanceMax(600)
    fg.d3Force("link")?.distance((l: GraphLink) => {
      const t = typeof l.target === "object" ? l.target : null
      return 50 + (t?.radius ?? 8)
    })
    fg.d3ReheatSimulation?.()
  }, [])

  const didFitRef = useRef(false)
  const handleEngineStop = useCallback(() => {
    if (didFitRef.current) return
    didFitRef.current = true
    fgRef.current?.zoomToFit(500, 70)
  }, [])

  // ── Canvas painters ────────────────────────────────────────────────────────
  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const r = node.radius
      const matches = matchingIdsRef.current
      const isDim = matches ? !matches.has(node.id) : false
      ctx.globalAlpha = isDim ? 0.12 : 1

      // Body
      ctx.beginPath()
      ctx.arc(node.x!, node.y!, r, 0, Math.PI * 2)
      ctx.fillStyle = node.color + "26"
      ctx.fill()

      if (node.isVirtual) {
        ctx.lineWidth = 1.5
        ctx.strokeStyle = node.color + "cc"
        ctx.setLineDash([4, 3])
        ctx.stroke()
        ctx.setLineDash([])
      } else {
        ctx.lineWidth = 1.5
        ctx.strokeStyle = node.color + "99"
        ctx.stroke()

        // Flag, clipped to the circle
        if (node.flagUrl) {
          const img = flagCache.current.get(node.flagUrl)
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.save()
            ctx.beginPath()
            ctx.arc(node.x!, node.y!, r - 2, 0, Math.PI * 2)
            ctx.clip()
            const s = (r - 2) * 2
            ctx.drawImage(img, node.x! - s / 2, node.y! - s / 2, s, s)
            ctx.restore()
          }
        }
      }

      // Label — keep ~constant screen size, hide tiny ones when zoomed out
      const showLabel = globalScale > 0.35 || node.familySize > 8 || node.isVirtual
      if (showLabel) {
        const fontSize = Math.min(14, 11 / globalScale)
        ctx.font = `600 ${fontSize}px var(--font-jakarta), ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        const labelY = node.y! + r + fontSize * 0.9
        // Halo for legibility on either theme
        ctx.lineWidth = 3
        ctx.strokeStyle = bgColorRef.current
        ctx.strokeText(node.name, node.x!, labelY)
        ctx.fillStyle = node.isVirtual ? node.color : fgColorRef.current
        ctx.fillText(node.name, node.x!, labelY)

        if (node.isVirtual && globalScale > 0.5) {
          ctx.font = `500 ${fontSize * 0.75}px var(--font-jakarta), ui-sans-serif, system-ui, sans-serif`
          ctx.fillStyle = node.color + "cc"
          ctx.fillText("Family", node.x!, labelY + fontSize)
        }
      }

      ctx.globalAlpha = 1
    },
    []
  )

  const paintPointerArea = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(node.x!, node.y!, node.radius + 2, 0, Math.PI * 2)
      ctx.fill()
    },
    []
  )

  const linkColor = useCallback((link: GraphLink) => {
    const matches = matchingIdsRef.current
    if (matches) {
      const s = typeof link.source === "object" ? link.source.id : link.source
      const t = typeof link.target === "object" ? link.target.id : link.target
      const lit = matches.has(s) || matches.has(t)
      return link.color + (lit ? "66" : "10")
    }
    return link.color + "4d"
  }, [])

  // ── Interaction handlers ──────────────────────────────────────────────────
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.slug) router.push(`/lang/${node.slug}`)
    },
    [router]
  )

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node)
    if (containerRef.current) {
      containerRef.current.style.cursor =
        node && !node.isVirtual ? "pointer" : "grab"
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (hoveredNode) setTooltipPos({ x: e.clientX, y: e.clientY })
  }, [hoveredNode])

  const zoomBy = useCallback((factor: number) => {
    const fg = fgRef.current
    if (!fg) return
    fg.zoom(Math.max(0.05, Math.min(8, fg.zoom() * factor)), 250)
  }, [])

  const handleFitView = useCallback(() => {
    fgRef.current?.zoomToFit(500, 70)
  }, [])

  const handleFocusMatch = useCallback(() => {
    if (!matchingIds || matchingIds.size === 0) return
    const firstId = nodes.find((n) => matchingIds.has(n.id))?.id
    const target = nodes.find((n) => n.id === firstId)
    const fg = fgRef.current
    if (target && fg && target.x != null && target.y != null) {
      fg.centerAt(target.x, target.y, 600)
      fg.zoom(2, 600)
    }
  }, [matchingIds, nodes])

  if (languages.length === 0) return null

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="w-full h-full relative aurora-glass rounded-[28px] sm:rounded-[36px] overflow-hidden"
      style={{ cursor: "grab" }}
    >
      <AuroraBackground variant="subtle" grid={false} />

      {/* Soft vignette so nodes near the edge fade into the glass */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(ellipse_80%_70%_at_50%_45%,transparent,hsl(var(--background)/0.55))]" />

      {dimensions.width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          nodeRelSize={1}
          nodeVal={(n: GraphNode) => n.radius}
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={paintPointerArea}
          linkColor={linkColor}
          linkWidth={1.2}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          linkDirectionalArrowColor={linkColor}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          onEngineStop={handleEngineStop}
          onEngineTick={configureForces}
          cooldownTicks={120}
          warmupTicks={20}
          enableNodeDrag={false}
          minZoom={0.05}
          maxZoom={8}
        />
      )}

      {/* Tooltip */}
      {hoveredNode && (
        <div
          className="fixed z-50 pointer-events-none aurora-glass px-3 py-2 rounded-xl text-sm max-w-[220px] font-display"
          style={{
            left: tooltipPos.x + 14,
            top: tooltipPos.y - 10,
            transform: "translateY(-100%)",
          }}
        >
          <div className="font-bold tracking-tight">{hoveredNode.name}</div>
          {!hoveredNode.isVirtual ? (
            <>
              <div className="text-xs text-muted-foreground">
                {hoveredNode.count.toLocaleString()} words
              </div>
              {hoveredNode.ownerName && (
                <div className="text-xs text-muted-foreground">
                  by {hoveredNode.ownerName}
                </div>
              )}
            </>
          ) : (
            hoveredNode.familySize > 0 && (
              <div className="text-xs text-muted-foreground">
                {hoveredNode.familySize} language
                {hoveredNode.familySize !== 1 ? "s" : ""}
              </div>
            )
          )}
          {hoveredNode.fromFamily && !hoveredNode.isVirtual && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: hoveredNode.color }}
              />
              {hoveredNode.familyLabel}
            </div>
          )}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-1.5">
        <Button
          variant="outline"
          size="icon"
          onClick={() => zoomBy(1.3)}
          className="h-9 w-9 rounded-full bg-card/70 backdrop-blur-md border-border/60 hover:border-primary/40"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => zoomBy(0.75)}
          className="h-9 w-9 rounded-full bg-card/70 backdrop-blur-md border-border/60 hover:border-primary/40"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleFitView}
          className="h-9 w-9 rounded-full bg-card/70 backdrop-blur-md border-border/60 hover:border-primary/40"
        >
          <Maximize className="h-4 w-4" />
        </Button>
      </div>

      {/* Search + title overlay */}
      <div className="absolute top-6 left-6 right-6 z-20 flex flex-col sm:flex-row items-end sm:items-start justify-between gap-4 pointer-events-none">
        <div className="sm:hidden pointer-events-auto w-full flex justify-end">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="h-10 w-10 rounded-full bg-card/70 backdrop-blur-md border-border/60"
          >
            <Search className="h-5 w-5" />
          </Button>
        </div>

        <div
          className={`aurora-glass p-4 rounded-2xl pointer-events-auto w-full sm:max-w-xs font-display transition-all ${
            isSearchOpen ? "block" : "hidden sm:block"
          }`}
        >
          <h3 className="text-lg font-extrabold tracking-tight mb-1">
            The Constructed <span className="aurora-gradient-text">Universe</span>
          </h3>
          <p className="text-xs text-muted-foreground flex items-center gap-2 mb-4">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            Live map of public language families
          </p>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Locate a language..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-background/50 border-border rounded-full"
            />
          </div>

          {searchQuery.trim() && (
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>
                {matchCount} match{matchCount !== 1 ? "es" : ""}
              </span>
              {matchCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFocusMatch}
                  className="h-6 gap-1.5 text-xs px-2 hover:bg-primary/10 hover:text-primary"
                  type="button"
                >
                  <Focus className="h-3 w-3" />
                  Focus
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-6 left-6 z-20 pointer-events-none hidden sm:block">
        <div className="aurora-glass p-2.5 rounded-xl font-display">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
            Controls
          </p>
          <p className="text-xs text-muted-foreground/80 mt-1">
            Drag to pan · Ctrl/⌘+Scroll or pinch to zoom · Click to explore
          </p>
        </div>
      </div>
    </div>
  )
}
