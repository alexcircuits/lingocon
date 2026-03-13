"use client"

import { useMemo, useState } from "react"

interface LanguageData {
  id: string
  name: string
  slug: string
  parentLanguageId: string | null
  externalAncestry: string | null
  ownerId: string
  createdAt: string | Date
  _count: { dictionaryEntries: number }
}

interface TimelineProps {
  languages: LanguageData[]
  currentUserId: string
}

interface TimelineNode {
  lang: LanguageData
  x: number
  y: number
  date: Date
  depth: number
  lane: number
}

export function FamilyTimeline({ languages, currentUserId }: TimelineProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const { nodes, connections, months, totalWidth } = useMemo(() => {
    if (languages.length === 0) return { nodes: [], connections: [], months: [], totalWidth: 0 }

    const byId = new Map(languages.map(l => [l.id, l]))
    const childrenMap = new Map<string, string[]>()
    byId.forEach((_, id) => childrenMap.set(id, []))
    languages.forEach(l => {
      if (l.parentLanguageId && childrenMap.has(l.parentLanguageId)) {
        childrenMap.get(l.parentLanguageId)!.push(l.id)
      }
    })

    // Sort by createdAt
    const sorted = [...languages].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    const earliest = new Date(sorted[0].createdAt)
    const latest = new Date(sorted[sorted.length - 1].createdAt)

    // Pad dates by 1 day on each side
    const minD = new Date(earliest.getTime() - 86400000)
    const maxD = new Date(latest.getTime() + 86400000)
    const range = Math.max(maxD.getTime() - minD.getTime(), 86400000)

    // Generate month markers
    const monthMarkers: { label: string; x: number }[] = []
    const cursor = new Date(minD.getFullYear(), minD.getMonth(), 1)
    while (cursor <= maxD) {
      const pos = (cursor.getTime() - minD.getTime()) / range
      monthMarkers.push({
        label: cursor.toLocaleString("en", { month: "short", year: "2-digit" }),
        x: pos,
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }

    // Compute depth from root for lane assignment
    function getDepth(id: string, visited = new Set<string>()): number {
      if (visited.has(id)) return 0
      visited.add(id)
      const lang = byId.get(id)
      if (!lang?.parentLanguageId || !byId.has(lang.parentLanguageId)) return 0
      return 1 + getDepth(lang.parentLanguageId, visited)
    }

    // Minimum pixel distance between node centers
    const w = Math.max(800, languages.length * 120)
    const usableWidth = w - 120 // account for 60px padding on each side
    const minPixelDistance = 60 // minimum 60px between node centers

    // Build nodes with proper collision avoidance
    // Track ALL occupied positions as {x (pixel), lane} pairs
    const occupiedPositions: { px: number; lane: number }[] = []

    const nodeList: TimelineNode[] = sorted.map((lang) => {
      const date = new Date(lang.createdAt)
      const x = (date.getTime() - minD.getTime()) / range
      const px = 60 + x * usableWidth
      const depth = getDepth(lang.id)

      // Find a lane with no collision at this x position
      let lane = depth
      let attempts = 0
      while (attempts < 50) {
        const collision = occupiedPositions.some(
          pos => pos.lane === lane && Math.abs(pos.px - px) < minPixelDistance
        )
        if (!collision) break
        // Try next available lane (increment by 1 to avoid half-lane overlaps)
        lane += 1
        attempts++
      }

      occupiedPositions.push({ px, lane })

      return { lang, x, y: 0, date, depth, lane }
    })

    // Assign y based on lane index
    const allLanes = [...new Set(nodeList.map(n => n.lane))].sort((a, b) => a - b)
    const laneToY = new Map(allLanes.map((l, i) => [l, i]))
    nodeList.forEach(n => {
      n.y = laneToY.get(n.lane) || 0
    })

    // Build connections
    const conns: { from: TimelineNode; to: TimelineNode }[] = []
    const nodeMap = new Map(nodeList.map(n => [n.lang.id, n]))
    nodeList.forEach(n => {
      if (n.lang.parentLanguageId && nodeMap.has(n.lang.parentLanguageId)) {
        conns.push({
          from: nodeMap.get(n.lang.parentLanguageId)!,
          to: n,
        })
      }
    })

    return {
      nodes: nodeList,
      connections: conns,
      months: monthMarkers,
      totalWidth: w,
    }
  }, [languages])

  if (languages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No languages to display on the timeline.
      </div>
    )
  }

  const nodeRadius = 24
  const laneHeight = 80
  const paddingTop = 60
  const paddingBottom = 40
  const maxLane = Math.max(...nodes.map(n => n.y), 0)
  const svgHeight = paddingTop + (maxLane + 1) * laneHeight + paddingBottom

  return (
    <div className="h-full overflow-auto bg-card/50 rounded-lg border">
      <svg
        width={totalWidth}
        height={svgHeight}
        className="select-none"
        style={{ minWidth: "100%" }}
      >
        {/* Month markers */}
        {months.map((m, i) => {
          const mx = 60 + m.x * (totalWidth - 120)
          return (
            <g key={i}>
              <line
                x1={mx} y1={paddingTop - 15}
                x2={mx} y2={svgHeight - paddingBottom + 10}
                stroke="currentColor"
                strokeOpacity={0.06}
                strokeDasharray="4 4"
              />
              <text
                x={mx} y={paddingTop - 22}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.3}
                fontSize={10}
                fontFamily="system-ui"
              >
                {m.label}
              </text>
            </g>
          )
        })}

        {/* Connections */}
        {connections.map((conn, i) => {
          const x1 = 60 + conn.from.x * (totalWidth - 120)
          const y1 = paddingTop + conn.from.y * laneHeight + nodeRadius
          const x2 = 60 + conn.to.x * (totalWidth - 120)
          const y2 = paddingTop + conn.to.y * laneHeight + nodeRadius

          // Curved path
          const midX = (x1 + x2) / 2
          const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`

          const isHighlighted = hoveredId === conn.from.lang.id || hoveredId === conn.to.lang.id

          return (
            <path
              key={i}
              d={path}
              fill="none"
              stroke={isHighlighted ? "hsl(var(--primary))" : "currentColor"}
              strokeOpacity={isHighlighted ? 0.8 : 0.15}
              strokeWidth={isHighlighted ? 2.5 : 1.5}
              className="transition-all duration-200"
            />
          )
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const cx = 60 + node.x * (totalWidth - 120)
          const cy = paddingTop + node.y * laneHeight + nodeRadius
          const isHovered = hoveredId === node.lang.id
          const isRoot = !node.lang.parentLanguageId
          const isOwn = node.lang.ownerId === currentUserId
          const words = node.lang._count.dictionaryEntries

          return (
            <g
              key={node.lang.id}
              onMouseEnter={() => setHoveredId(node.lang.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => window.open(`/studio/lang/${node.lang.slug}`, "_blank")}
              className="cursor-pointer"
            >
              {/* Glow on hover */}
              {isHovered && (
                <circle
                  cx={cx} cy={cy} r={nodeRadius + 6}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.1}
                  className="animate-pulse"
                />
              )}

              {/* Node circle */}
              <circle
                cx={cx} cy={cy} r={nodeRadius}
                fill={isRoot
                  ? "hsl(var(--primary) / 0.15)"
                  : isOwn
                  ? "hsl(var(--secondary))"
                  : "hsl(var(--muted))"
                }
                stroke={isHovered
                  ? "hsl(var(--primary))"
                  : isRoot
                  ? "hsl(var(--primary) / 0.5)"
                  : "hsl(var(--border))"
                }
                strokeWidth={isHovered ? 2.5 : 1.5}
                className="transition-all duration-200"
              />

              {/* Name */}
              <text
                x={cx} y={cy - 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="currentColor"
                fontSize={node.lang.name.length > 8 ? 9 : 11}
                fontWeight={600}
                fontFamily="system-ui"
                className="pointer-events-none"
              >
                {node.lang.name.length > 12
                  ? node.lang.name.slice(0, 10) + "…"
                  : node.lang.name}
              </text>

              {/* Word count */}
              <text
                x={cx} y={cy + 12}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.4}
                fontSize={8}
                fontFamily="system-ui"
                className="pointer-events-none"
              >
                {words} words
              </text>

              {/* Date label below */}
              <text
                x={cx} y={cy + nodeRadius + 14}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={isHovered ? 0.6 : 0.25}
                fontSize={9}
                fontFamily="system-ui"
                className="transition-all duration-200 pointer-events-none"
              >
                {node.date.toLocaleDateString("en", { month: "short", day: "numeric" })}
              </text>

              {/* Tooltip on hover */}
              {isHovered && (
                <g>
                  <rect
                    x={cx - 85} y={cy - nodeRadius - 48}
                    width={170} height={36}
                    rx={8}
                    fill="hsl(var(--popover))"
                    stroke="hsl(var(--border))"
                    strokeWidth={1}
                  />
                  <text
                    x={cx} y={cy - nodeRadius - 34}
                    textAnchor="middle"
                    fill="hsl(var(--popover-foreground))"
                    fontSize={10}
                    fontFamily="system-ui"
                  >
                    {node.lang.externalAncestry
                      ? `${node.lang.externalAncestry} family`
                      : isRoot ? "Root language" : "Click to open in Studio"
                    }
                  </text>
                  <text
                    x={cx} y={cy - nodeRadius - 20}
                    textAnchor="middle"
                    fill="hsl(var(--muted-foreground))"
                    fontSize={9}
                    fontFamily="system-ui"
                  >
                    {words} words • depth {node.depth}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
