"use client"

import { useRef, useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, Focus, X, ZoomIn, ZoomOut, Maximize } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const FAMILY_COLORS = [
  "#3b82f6", // Blue
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#10b981", // Emerald
  "#06b6d4", // Cyan
]

interface LanguageData {
  id: string
  name: string
  slug: string
  flagUrl: string | null
  parentLanguageId: string | null
  externalAncestry?: string | null
  familyId?: string | null
  family?: { id: string; name: string } | null
  owner: { name: string }
  _count: { dictionaryEntries: number }
}

interface MapNode {
  id: string
  name: string
  slug: string
  x: number
  y: number
  radius: number
  color: string
  isVirtual: boolean
  flagUrl: string | null
  count: number
  familySize: number
  ownerName: string
}

interface MapEdge {
  sourceId: string
  targetId: string
  color: string
  dashed: boolean
}

function buildMapData(languages: LanguageData[]) {
  const nodes: MapNode[] = []
  const edges: MapEdge[] = []

  const languageByName = new Map(languages.map(l => [l.name, l]))

  // Group by family first, fall back to externalAncestry for virtual roots
  const getResolvedParentId = (l: LanguageData): string | null => {
    if (l.parentLanguageId) return l.parentLanguageId
    if (l.externalAncestry) {
      const actualParent = languageByName.get(l.externalAncestry)
      if (actualParent && actualParent.id !== l.id) return actualParent.id
      return `virtual-${l.externalAncestry}`
    }
    return null
  }

  // Create virtual root nodes for external ancestry
  const virtualRootsMap = new Map<string, { id: string; name: string }>()
  languages.forEach(l => {
    if (!l.parentLanguageId && l.externalAncestry) {
      const actualParent = languageByName.get(l.externalAncestry)
      if (!actualParent && !virtualRootsMap.has(l.externalAncestry)) {
        virtualRootsMap.set(l.externalAncestry, {
          id: `virtual-${l.externalAncestry}`,
          name: l.externalAncestry,
        })
      }
    }
  })

  // Build children map
  const allIds = new Set([...languages.map(l => l.id), ...Array.from(virtualRootsMap.values()).map(v => v.id)])
  const childrenMap = new Map<string, string[]>()
  allIds.forEach(id => childrenMap.set(id, []))

  languages.forEach(l => {
    const pid = getResolvedParentId(l)
    if (pid && childrenMap.has(pid)) {
      childrenMap.get(pid)!.push(l.id)
    }
  })

  // Compute family sizes
  const familySizeMap = new Map<string, number>()
  const computeFamilySize = (nodeId: string): number => {
    if (familySizeMap.has(nodeId)) return familySizeMap.get(nodeId)!
    let size = childrenMap.get(nodeId)?.length || 0
    for (const child of childrenMap.get(nodeId) || []) {
      size += computeFamilySize(child)
    }
    familySizeMap.set(nodeId, size)
    return size
  }

  // Find roots
  const trueRoots: Array<{ id: string; name: string; isVirtual: boolean; flagUrl: string | null; count: number; ownerName: string; slug: string }> = []

  virtualRootsMap.forEach(v => {
    trueRoots.push({ id: v.id, name: v.name, isVirtual: true, flagUrl: null, count: 0, ownerName: "", slug: "" })
  })

  languages.forEach(l => {
    if (getResolvedParentId(l) === null) {
      trueRoots.push({ id: l.id, name: l.name, isVirtual: false, flagUrl: l.flagUrl, count: l._count.dictionaryEntries, ownerName: l.owner.name, slug: l.slug })
    }
  })

  trueRoots.forEach(r => computeFamilySize(r.id))

  // Layout: Vogel's spiral for roots
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const spread = 350

  trueRoots.forEach((root, i) => {
    const color = root.isVirtual
      ? FAMILY_COLORS[i % FAMILY_COLORS.length]
      : FAMILY_COLORS[(i + 3) % FAMILY_COLORS.length]

    const r = spread * Math.sqrt(i + 1)
    const theta = i * goldenAngle
    const x = Math.cos(theta) * r
    const y = Math.sin(theta) * r
    const familySize = familySizeMap.get(root.id) || 0

    const baseRadius = root.isVirtual
      ? 30 + Math.min(20, Math.log10(Math.max(1, familySize)) * 12)
      : 20 + Math.max(0, Math.log10(Math.max(1, root.count)) * 6) + Math.min(8, familySize * 1)

    nodes.push({
      id: root.id,
      name: root.name,
      slug: root.slug,
      x, y,
      radius: baseRadius,
      color,
      isVirtual: root.isVirtual,
      flagUrl: root.flagUrl,
      count: root.count,
      familySize,
      ownerName: root.ownerName,
    })

    // BFS to place descendants
    const queue = [{ nodeId: root.id, px: x, py: y, level: 1, color }]
    while (queue.length > 0) {
      const { nodeId: parentId, px, py, level, color: nodeColor } = queue.shift()!
      const daughters = childrenMap.get(parentId) || []
      const dRadius = 240 + level * 60

      daughters.forEach((dId, di) => {
        const lang = languages.find(l => l.id === dId)
        if (!lang) return

        const arcSweep = daughters.length > 6 ? Math.PI * 1.5 : Math.PI
        const spreadAngle = daughters.length > 1 ? arcSweep / Math.max(daughters.length - 1, 1) : 0
        const startAngle = (Math.PI / 4) * level - spreadAngle * (daughters.length - 1) / 2
        const dAngle = daughters.length === 1 ? (Math.PI / 4) * level : startAngle + spreadAngle * di
        const dx = px + Math.cos(dAngle) * dRadius
        const dy = py + Math.sin(dAngle) * dRadius
        const fSize = familySizeMap.get(dId) || 0

        const nodeRadius = 20 + Math.max(0, Math.log10(Math.max(1, lang._count.dictionaryEntries)) * 6) + Math.min(8, fSize * 1)

        nodes.push({
          id: dId,
          name: lang.name,
          slug: lang.slug,
          x: dx, y: dy,
          radius: nodeRadius,
          color: nodeColor,
          isVirtual: false,
          flagUrl: lang.flagUrl,
          count: lang._count.dictionaryEntries,
          familySize: fSize,
          ownerName: lang.owner.name,
        })

        edges.push({
          sourceId: parentId,
          targetId: dId,
          color: nodeColor,
          dashed: root.isVirtual && level === 1,
        })

        queue.push({ nodeId: dId, px: dx, py: dy, level: level + 1, color: nodeColor })
      })
    }
  })

  return { nodes, edges }
}

export function LingoConUniverseMap({ languages }: { languages: LanguageData[] }) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Viewport state
  const viewRef = useRef({ x: 0, y: 0, scale: 1 })
  const [, forceRender] = useState(0)

  // Interaction state
  const dragRef = useRef<{ startX: number; startY: number; viewX: number; viewY: number } | null>(null)
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null)
  const [hoveredNode, setHoveredNode] = useState<MapNode | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Precompute layout
  const { nodes, edges } = useMemo(() => buildMapData(languages), [languages])

  // Flag image cache
  const flagCache = useRef(new Map<string, HTMLImageElement>())

  // Preload flag images
  useEffect(() => {
    nodes.forEach(node => {
      if (node.flagUrl && !flagCache.current.has(node.flagUrl)) {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = node.flagUrl
        flagCache.current.set(node.flagUrl, img)
      }
    })
  }, [nodes])

  // Hit test: find node under screen coords
  const hitTest = useCallback((screenX: number, screenY: number): MapNode | null => {
    const view = viewRef.current
    const worldX = (screenX - view.x) / view.scale
    const worldY = (screenY - view.y) / view.scale

    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i]
      const dx = worldX - node.x
      const dy = worldY - node.y
      if (dx * dx + dy * dy <= (node.radius + 5) * (node.radius + 5)) {
        return node
      }
    }
    return null
  }, [nodes])

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const view = viewRef.current

    // Viewport culling bounds
    const pad = 100
    const minX = -pad / view.scale - view.x / view.scale
    const maxX = (w + pad) / view.scale - view.x / view.scale
    const minY = -pad / view.scale - view.y / view.scale
    const maxY = (h + pad) / view.scale - view.y / view.scale

    // Search filtering
    const matchingIds = searchQuery.trim()
      ? new Set(nodes.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase())).map(n => n.id))
      : null

    ctx.save()
    ctx.translate(view.x, view.y)
    ctx.scale(view.scale, view.scale)

    // Draw edges
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    edges.forEach(edge => {
      const src = nodeMap.get(edge.sourceId)
      const tgt = nodeMap.get(edge.targetId)
      if (!src || !tgt) return

      // Cull edges entirely outside viewport
      const edgeMinX = Math.min(src.x, tgt.x)
      const edgeMaxX = Math.max(src.x, tgt.x)
      const edgeMinY = Math.min(src.y, tgt.y)
      const edgeMaxY = Math.max(src.y, tgt.y)
      if (edgeMaxX < minX || edgeMinX > maxX || edgeMaxY < minY || edgeMinY > maxY) return

      const alpha = matchingIds ? (matchingIds.has(edge.sourceId) || matchingIds.has(edge.targetId) ? 0.5 : 0.05) : 0.3
      ctx.strokeStyle = edge.color
      ctx.globalAlpha = alpha
      ctx.lineWidth = 1.5

      if (edge.dashed) {
        ctx.setLineDash([6, 4])
      } else {
        ctx.setLineDash([])
      }

      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(tgt.x, tgt.y)
      ctx.stroke()

      // Arrowhead
      const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x)
      const arrowLen = 8
      const tipX = tgt.x - Math.cos(angle) * tgt.radius
      const tipY = tgt.y - Math.sin(angle) * tgt.radius

      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(tipX, tipY)
      ctx.lineTo(tipX - arrowLen * Math.cos(angle - 0.4), tipY - arrowLen * Math.sin(angle - 0.4))
      ctx.lineTo(tipX - arrowLen * Math.cos(angle + 0.4), tipY - arrowLen * Math.sin(angle + 0.4))
      ctx.closePath()
      ctx.fillStyle = edge.color
      ctx.fill()
    })

    ctx.setLineDash([])

    // Draw nodes
    nodes.forEach(node => {
      // Viewport culling
      if (node.x + node.radius < minX || node.x - node.radius > maxX ||
          node.y + node.radius < minY || node.y - node.radius > maxY) return

      const isMatch = matchingIds ? matchingIds.has(node.id) : true
      const nodeAlpha = matchingIds ? (isMatch ? 1 : 0.15) : 1
      ctx.globalAlpha = nodeAlpha

      // Draw circle
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)

      if (node.isVirtual) {
        ctx.fillStyle = `${node.color}15`
        ctx.fill()
        ctx.strokeStyle = `${node.color}80`
        ctx.lineWidth = 2
        ctx.setLineDash([4, 3])
        ctx.stroke()
        ctx.setLineDash([])
      } else {
        ctx.fillStyle = `${node.color}1a`
        ctx.fill()
        ctx.strokeStyle = `${node.color}60`
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Draw flag image if available
        if (node.flagUrl) {
          const img = flagCache.current.get(node.flagUrl)
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.save()
            ctx.beginPath()
            ctx.arc(node.x, node.y, node.radius - 3, 0, Math.PI * 2)
            ctx.clip()
            const s = (node.radius - 3) * 2
            ctx.drawImage(img, node.x - s / 2, node.y - s / 2, s, s)
            ctx.restore()
          }
        }
      }

      // Draw label
      const fontSize = Math.max(10, Math.min(14, node.radius * 0.45))
      ctx.font = `bold ${fontSize}px ui-serif, Georgia, serif`
      ctx.fillStyle = node.isVirtual ? node.color : "currentColor"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      // Use a readable color that works on both light/dark
      const textColor = node.isVirtual ? node.color : "#e5e7eb"
      ctx.fillStyle = textColor

      // Text below node for nodes with flags, centered for others
      const textY = (node.flagUrl && !node.isVirtual) ? node.y + node.radius + fontSize + 2 : node.y

      ctx.fillText(node.name, node.x, textY, node.radius * 3)

      // Draw count badge for non-virtual nodes
      if (!node.isVirtual && node.count > 0) {
        const badgeY = (node.flagUrl ? node.y + node.radius + fontSize + 14 : node.y + node.radius + 10)
        ctx.font = `${Math.max(8, fontSize * 0.7)}px ui-sans-serif, system-ui, sans-serif`
        ctx.fillStyle = `${node.color}b3`
        ctx.fillText(`${node.count} words`, node.x, badgeY)
      }

      // Virtual node subtitle
      if (node.isVirtual) {
        ctx.font = `${Math.max(8, fontSize * 0.6)}px ui-sans-serif, system-ui, sans-serif`
        ctx.fillStyle = `${node.color}99`
        ctx.fillText("Language Family", node.x, node.y + fontSize + 4)
        if (node.familySize > 0) {
          ctx.fillText(`${node.familySize} language${node.familySize !== 1 ? "s" : ""}`, node.x, node.y + fontSize + 16)
        }
      }
    })

    ctx.restore()
    ctx.globalAlpha = 1
  }, [nodes, edges, searchQuery])

  // Animation frame loop
  const rafRef = useRef<number>(0)
  const scheduleRedraw = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(draw)
  }, [draw])

  // Initial fit & resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || nodes.length === 0) return

    // Compute bounding box
    let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity
    nodes.forEach(n => {
      bMinX = Math.min(bMinX, n.x - n.radius)
      bMinY = Math.min(bMinY, n.y - n.radius)
      bMaxX = Math.max(bMaxX, n.x + n.radius)
      bMaxY = Math.max(bMaxY, n.y + n.radius)
    })

    const bw = bMaxX - bMinX
    const bh = bMaxY - bMinY
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    const pad = 80

    const scale = Math.min((cw - pad * 2) / bw, (ch - pad * 2) / bh, 1.5)
    const cx = (bMinX + bMaxX) / 2
    const cy = (bMinY + bMaxY) / 2

    viewRef.current = {
      x: cw / 2 - cx * scale,
      y: ch / 2 - cy * scale,
      scale,
    }

    scheduleRedraw()
  }, [nodes, scheduleRedraw])

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const ro = new ResizeObserver(() => scheduleRedraw())
    ro.observe(container)
    return () => ro.disconnect()
  }, [scheduleRedraw])

  // Redraw on search change
  useEffect(() => {
    scheduleRedraw()
  }, [searchQuery, scheduleRedraw])

  // Mouse/touch handlers
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handlePointerDown = (e: PointerEvent) => {
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        viewX: viewRef.current.x,
        viewY: viewRef.current.y,
      }
      canvas.setPointerCapture(e.pointerId)
    }

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top

      if (dragRef.current) {
        viewRef.current.x = dragRef.current.viewX + (e.clientX - dragRef.current.startX)
        viewRef.current.y = dragRef.current.viewY + (e.clientY - dragRef.current.startY)
        scheduleRedraw()
      } else {
        const node = hitTest(sx, sy)
        if (node) {
          canvas.style.cursor = node.isVirtual ? "default" : "pointer"
          setHoveredNode(node)
          setTooltipPos({ x: e.clientX, y: e.clientY })
        } else {
          canvas.style.cursor = "grab"
          setHoveredNode(null)
        }
      }
    }

    const handlePointerUp = (e: PointerEvent) => {
      if (dragRef.current) {
        const moved = Math.abs(e.clientX - dragRef.current.startX) + Math.abs(e.clientY - dragRef.current.startY)
        if (moved < 5) {
          // It was a click, not a drag
          const rect = canvas.getBoundingClientRect()
          const node = hitTest(e.clientX - rect.left, e.clientY - rect.top)
          if (node && node.slug) {
            router.push(`/lang/${node.slug}`)
          }
        }
        dragRef.current = null
        canvas.releasePointerCapture(e.pointerId)
      }
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      // Ctrl+wheel = zoom, plain wheel = pan
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY > 0 ? 0.9 : 1.1
        const newScale = Math.max(0.05, Math.min(5, viewRef.current.scale * factor))
        const ratio = newScale / viewRef.current.scale

        viewRef.current.x = mx - (mx - viewRef.current.x) * ratio
        viewRef.current.y = my - (my - viewRef.current.y) * ratio
        viewRef.current.scale = newScale
      } else {
        viewRef.current.x -= e.deltaX
        viewRef.current.y -= e.deltaY
      }
      scheduleRedraw()
    }

    // Touch pinch-zoom
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        pinchRef.current = { dist: Math.hypot(dx, dy), scale: viewRef.current.scale }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        const ratio = dist / pinchRef.current.dist

        const newScale = Math.max(0.05, Math.min(5, pinchRef.current.scale * ratio))
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const rect = canvas.getBoundingClientRect()
        const mx = cx - rect.left
        const my = cy - rect.top

        const scaleRatio = newScale / viewRef.current.scale
        viewRef.current.x = mx - (mx - viewRef.current.x) * scaleRatio
        viewRef.current.y = my - (my - viewRef.current.y) * scaleRatio
        viewRef.current.scale = newScale
        scheduleRedraw()
      }
    }

    const handleTouchEnd = () => {
      pinchRef.current = null
    }

    canvas.addEventListener("pointerdown", handlePointerDown)
    canvas.addEventListener("pointermove", handlePointerMove)
    canvas.addEventListener("pointerup", handlePointerUp)
    canvas.addEventListener("wheel", handleWheel, { passive: false })
    canvas.addEventListener("touchstart", handleTouchStart, { passive: true })
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false })
    canvas.addEventListener("touchend", handleTouchEnd)

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown)
      canvas.removeEventListener("pointermove", handlePointerMove)
      canvas.removeEventListener("pointerup", handlePointerUp)
      canvas.removeEventListener("wheel", handleWheel)
      canvas.removeEventListener("touchstart", handleTouchStart)
      canvas.removeEventListener("touchmove", handleTouchMove)
      canvas.removeEventListener("touchend", handleTouchEnd)
    }
  }, [hitTest, scheduleRedraw, router])

  // Zoom controls
  const handleZoom = useCallback((factor: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cx = canvas.clientWidth / 2
    const cy = canvas.clientHeight / 2
    const newScale = Math.max(0.05, Math.min(5, viewRef.current.scale * factor))
    const ratio = newScale / viewRef.current.scale
    viewRef.current.x = cx - (cx - viewRef.current.x) * ratio
    viewRef.current.y = cy - (cy - viewRef.current.y) * ratio
    viewRef.current.scale = newScale
    scheduleRedraw()
  }, [scheduleRedraw])

  const handleFitView = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || nodes.length === 0) return

    let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity
    nodes.forEach(n => {
      bMinX = Math.min(bMinX, n.x - n.radius)
      bMinY = Math.min(bMinY, n.y - n.radius)
      bMaxX = Math.max(bMaxX, n.x + n.radius)
      bMaxY = Math.max(bMaxY, n.y + n.radius)
    })

    const bw = bMaxX - bMinX
    const bh = bMaxY - bMinY
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    const pad = 80

    const scale = Math.min((cw - pad * 2) / bw, (ch - pad * 2) / bh, 1.5)
    viewRef.current = {
      x: cw / 2 - ((bMinX + bMaxX) / 2) * scale,
      y: ch / 2 - ((bMinY + bMaxY) / 2) * scale,
      scale,
    }
    scheduleRedraw()
  }, [nodes, scheduleRedraw])

  // Search: focus on first match
  const matchingNodeIds = useMemo(() => searchQuery.trim()
    ? nodes.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase())).map(n => n.id)
    : [], [searchQuery, nodes])

  const handleFocusMatch = useCallback(() => {
    if (matchingNodeIds.length === 0) return
    const target = nodes.find(n => n.id === matchingNodeIds[0])
    if (!target || !canvasRef.current) return

    const cw = canvasRef.current.clientWidth
    const ch = canvasRef.current.clientHeight
    const scale = 1.2
    viewRef.current = {
      x: cw / 2 - target.x * scale,
      y: ch / 2 - target.y * scale,
      scale,
    }
    scheduleRedraw()
  }, [matchingNodeIds, nodes, scheduleRedraw])

  if (languages.length === 0) return null

  return (
    <div ref={containerRef} className="w-full h-full bg-secondary/20 relative rounded-3xl border border-border/50 overflow-hidden shadow-inner">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-background/0 via-background/40 to-background z-10" />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-0 touch-none"
        style={{ cursor: "grab" }}
      />

      {/* Tooltip */}
      {hoveredNode && (
        <div
          className="fixed z-50 pointer-events-none bg-card/95 backdrop-blur-md border border-border/60 px-3 py-2 rounded-lg shadow-lg text-sm max-w-[200px]"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 10, transform: "translateY(-100%)" }}
        >
          <div className="font-serif font-bold">{hoveredNode.name}</div>
          {!hoveredNode.isVirtual && (
            <>
              <div className="text-xs text-muted-foreground">{hoveredNode.count} words</div>
              {hoveredNode.ownerName && (
                <div className="text-xs text-muted-foreground">by {hoveredNode.ownerName}</div>
              )}
            </>
          )}
          {hoveredNode.isVirtual && hoveredNode.familySize > 0 && (
            <div className="text-xs text-muted-foreground">{hoveredNode.familySize} language{hoveredNode.familySize !== 1 ? "s" : ""}</div>
          )}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-1">
        <Button variant="outline" size="icon" onClick={() => handleZoom(1.3)} className="h-8 w-8 bg-background/80 backdrop-blur-sm">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => handleZoom(0.7)} className="h-8 w-8 bg-background/80 backdrop-blur-sm">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleFitView} className="h-8 w-8 bg-background/80 backdrop-blur-sm">
          <Maximize className="h-4 w-4" />
        </Button>
      </div>

      {/* Search overlay */}
      <div className="absolute top-6 left-6 right-6 z-20 flex flex-col sm:flex-row items-end sm:items-start justify-between gap-4 pointer-events-none">
        {/* Mobile Search Toggle */}
        <div className="sm:hidden pointer-events-auto w-full flex justify-end">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="h-10 w-10 rounded-full shadow-lg bg-background/80 backdrop-blur-md border-border/50"
          >
            {isSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>
        </div>

        <div className={`bg-background/80 backdrop-blur-md border border-border/50 p-4 rounded-xl shadow-lg pointer-events-auto w-full sm:max-w-xs transition-all ${isSearchOpen ? "block" : "hidden sm:block"}`}>
          <h3 className="font-serif font-medium text-lg mb-1">The Constructed Universe</h3>
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
              className="pl-9 h-9 text-sm bg-background/50 border-border"
            />
          </div>

          {searchQuery.trim() && (
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{matchingNodeIds.length} match{matchingNodeIds.length !== 1 ? "es" : ""}</span>
              {matchingNodeIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFocusMatch}
                  className="h-6 gap-1.5 text-xs px-2 hover:bg-muted/50"
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

      <div className="absolute bottom-6 left-6 z-20 pointer-events-none hidden sm:block">
        <div className="bg-background/80 backdrop-blur-md border border-border/50 p-2.5 rounded-lg shadow-lg">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            Controls
          </p>
          <p className="text-xs text-muted-foreground/80 mt-1">
            Scroll to pan · Ctrl+Scroll to zoom · Pinch to zoom · Click to explore
          </p>
        </div>
      </div>
    </div>
  )
}
