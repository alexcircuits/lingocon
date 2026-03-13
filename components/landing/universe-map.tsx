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
import { Globe, BookOpen } from "lucide-react"

// A simplified node for the public universe map
function UniverseNode({ data }: { data: any }) {
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
  owner: { name: string }
  _count: { dictionaryEntries: number }
}

export function LingoConUniverseMap({ languages }: { languages: LanguageData[] }) {
  const router = useRouter()

  const { nodes, edges } = useMemo(() => {
    const nds: Node[] = []
    const eds: Edge[] = []
    
    // We want a cool constellation layout.
    // For MVP, we'll use a circular/radial layout for each family tree family.
    // Group by families: 
    const roots = languages.filter(l => !l.parentLanguageId)
    
    // Place roots in a large circle
    const numRoots = roots.length
    const radius = Math.max(numRoots * 150, 400)
    
    roots.forEach((root, i) => {
      const angle = (i / numRoots) * Math.PI * 2
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      
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
        },
      })
      
      // BFS to place daughters in concentric circles around their parent
      let queue = [{ id: root.id, x, y, level: 1 }]
      while (queue.length > 0) {
        const parent = queue.shift()!
        
        const daughters = languages.filter(l => l.parentLanguageId === parent.id)
        const dRadius = 200 / parent.level 
        
        daughters.forEach((d, di) => {
          const dAngle = (di / daughters.length) * Math.PI * 2 + (Math.PI / 4 * parent.level) // offsets
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
            style: { stroke: "hsl(var(--primary))", strokeWidth: 1.5, strokeDasharray: "4 4", opacity: 0.5 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "hsl(var(--primary))",
              width: 15,
              height: 15,
            },
          })
          
          queue.push({ id: d.id, x: dx, y: dy, level: parent.level + 1 })
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
        minZoom={0.1}
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
