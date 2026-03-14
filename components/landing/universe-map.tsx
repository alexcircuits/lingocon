"use client"

import { useMemo } from "react"
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Node,
  MarkerType,
} from "reactflow"
import "reactflow/dist/style.css"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Globe, BookOpen, Sparkles } from "lucide-react"

// A simplified node for the public universe map
function UniverseNode({ data }: { data: any }) {
  if (data.isVirtual) {
    return (
      <Card className="min-w-[160px] p-4 bg-background/50 border-dashed border-2 border-border/60 hover:border-primary/50 transition-colors pointer-events-none rounded-xl shadow-sm text-center flex flex-col items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mb-1">
          <Sparkles className="h-4 w-4 text-primary/60" />
        </div>
        <div className="font-serif italic font-medium text-lg leading-tight text-muted-foreground">
          {data.label}
        </div>
        <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/50">
          Shared Ancestry
        </div>
      </Card>
    )
  }

  return (
    <Card className="min-w-[140px] p-3 bg-background/80 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-colors cursor-pointer group rounded-xl shadow-sm hover:shadow-primary/10">
      <div className="flex flex-col items-center text-center gap-1.5 pointer-events-none">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
          {data.flagUrl ? (
            <img src={data.flagUrl} alt={data.label} className="w-full h-full object-cover rounded-full opacity-80" />
          ) : (
            <Globe className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="font-serif font-medium text-sm leading-tight group-hover:text-primary transition-colors">
          {data.label}
        </div>
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          <BookOpen className="h-2.5 w-2.5" />
          <span>{data.count}</span>
        </div>
      </div>
    </Card>
  )
}

const nodeTypes = {
  universeNode: UniverseNode,
}

interface LanguageData {
  id: string
  name: string
  slug: string
  flagUrl: string | null
  parentLanguageId: string | null
  externalAncestry?: string | null
  owner: { name: string }
  _count: { dictionaryEntries: number }
}

export function LingoConUniverseMap({ languages }: { languages: LanguageData[] }) {
  const router = useRouter()

  const { nodes, edges } = useMemo(() => {
    const nds: Node[] = []
    const eds: Edge[] = []
    
    // We want a cool constellation layout.
    // Group by families and canonical ancestries: 
    const pureRoots = languages.filter(l => !l.parentLanguageId);
    
    const virtualRootsMap = new Map<string, any>()
    pureRoots.forEach(r => {
      if (r.externalAncestry && !virtualRootsMap.has(r.externalAncestry)) {
        virtualRootsMap.set(r.externalAncestry, {
          id: `virtual-${r.externalAncestry}`,
          name: r.externalAncestry,
          slug: "",
          flagUrl: null,
          parentLanguageId: null,
          isVirtual: true,
          owner: { name: "Canonical Ancestry" },
          _count: { dictionaryEntries: 0 }
        })
      }
    })

    const trueRoots = [
      ...Array.from(virtualRootsMap.values()),
      ...pureRoots.filter(r => !r.externalAncestry)
    ]
    
    // Place roots using Vogel's Spiral layout for a denser format
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    const spread = 250 // Scaling factor for spread
    
    trueRoots.forEach((root, i) => {
      // i + 1 so we don't overlap perfectly at 0,0
      const r = spread * Math.sqrt(i + 1)
      const theta = i * goldenAngle
      const x = Math.cos(theta) * r
      const y = Math.sin(theta) * r
      
      nds.push({
        id: root.id,
        type: "universeNode",
        position: { x, y },
        data: {
          label: root.name,
          slug: root.slug,
          count: root._count.dictionaryEntries,
          flagUrl: root.flagUrl,
          ownerName: root.owner.name,
          isVirtual: root.isVirtual
        },
      })
      
      // BFS to place daughters in concentric circles around their parent
      let queue = [{ id: root.id, isVirtual: root.isVirtual, name: root.name, x, y, level: 1 }]
      while (queue.length > 0) {
        const parent = queue.shift()!
        
        let daughters: LanguageData[] = []
        if (parent.isVirtual) {
          daughters = languages.filter(l => !l.parentLanguageId && l.externalAncestry === parent.name)
        } else {
          daughters = languages.filter(l => l.parentLanguageId === parent.id)
        }

        const dRadius = 180 + parent.level * 40
        
        daughters.forEach((d, di) => {
          const spreadAngle = daughters.length > 1 ? Math.PI / Math.max(daughters.length - 1, 1) : 0
          const startAngle = (Math.PI / 4) * parent.level - spreadAngle * (daughters.length - 1) / 2
          const dAngle = daughters.length === 1 ? (Math.PI / 4) * parent.level : startAngle + spreadAngle * di
          const dx = parent.x + Math.cos(dAngle) * dRadius
          const dy = parent.y + Math.sin(dAngle) * dRadius
          
          nds.push({
            id: d.id,
            type: "universeNode",
            position: { x: dx, y: dy },
            data: {
              label: d.name,
              slug: d.slug,
              count: d._count.dictionaryEntries,
              flagUrl: d.flagUrl,
              ownerName: d.owner.name,
            },
          })
          
          eds.push({
            id: `e-${parent.id}-${d.id}`,
            source: parent.id,
            target: d.id,
            type: "straight",
            animated: true,
            style: { stroke: "hsl(var(--primary))", strokeWidth: 1.5, strokeDasharray: parent.isVirtual ? "4 4" : "none", opacity: 0.5 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "hsl(var(--primary))",
              width: 15,
              height: 15,
            },
          })
          
          queue.push({ id: d.id, isVirtual: false, name: d.name, x: dx, y: dy, level: parent.level + 1 })
        })
      }
    })
    
    return { nodes: nds, edges: eds }
  }, [languages, router])

  if (languages.length === 0) return null

  return (
    <div className="w-full h-full bg-secondary/20 relative rounded-3xl border border-border/50 overflow-hidden shadow-inner inset-shadow">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-background/0 via-background/40 to-background z-10" />
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        onNodeClick={(_, node) => router.push(`/lang/${node.data.slug}`)}
        className="[&_.react-flow__pane]:cursor-grab [&_.react-flow__pane:active]:cursor-grabbing"
        minZoom={0.01}
        maxZoom={1.5}
        elementsSelectable={false}
        nodesConnectable={false}
        nodesDraggable={false}
        panOnScroll={true}
      >
        <Background color="hsl(var(--muted-foreground)/0.2)" gap={32} size={2} />
        <Controls showInteractive={false} className="z-20 bg-background/80 backdrop-blur-sm border-border fill-foreground" />
      </ReactFlow>
      
      {/* Decorative Legend */}
      <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
        <div className="bg-background/80 backdrop-blur-md border border-border/50 p-4 rounded-xl shadow-lg">
          <h3 className="font-serif font-medium text-lg mb-1">The Constructed Universe</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            Live map of public language families
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-3 pt-3 border-t border-border/40">
            Drag to pan • Scroll to zoom • Click to explore
          </p>
        </div>
      </div>
    </div>
  )
}
