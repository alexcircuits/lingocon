"use client"

import { useMemo, useState } from "react"
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Node,
  MarkerType,
  Handle,
  Position,
  MiniMap
} from "reactflow"
import "reactflow/dist/style.css"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Globe, BookOpen, Sparkles, Search, Focus, X } from "lucide-react"
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

// A simplified node for the public universe map
function UniverseNode({ data }: { data: any }) {
  const count = data.count || 0;
  const familySize = data.familySize || 0;

  if (data.isVirtual) {
    // scale based on how many family languages
    const scale = 1 + Math.min(1.5, Math.log10(Math.max(1, familySize)) * 0.6);

    return (
      <>
        <Handle type="target" position={Position.Top} className="opacity-0" />
        <Card style={{ transform: `scale(${scale})` }} className="min-w-[160px] p-4 bg-background/50 border-dashed border-2 border-primary/40 hover:border-primary transition-all pointer-events-none rounded-xl shadow-[0_0_15px_-3px_hsl(var(--primary)/0.2)] text-center flex flex-col items-center gap-2">
          <div 
            className="h-10 w-10 relative rounded-full flex items-center justify-center mb-1"
            style={{ backgroundColor: `${data.color}33` }} // 33 = 20% opacity hex
          >
            <Sparkles className="h-5 w-5 relative z-10" style={{ color: data.color }} />
            <div 
              className="absolute inset-0 rounded-full blur-md -z-10 animate-pulse"
              style={{ backgroundColor: `${data.color}66` }} // 66 = 40% opacity
            ></div>
          </div>
          <div className="font-serif italic font-bold text-xl leading-tight text-foreground drop-shadow-md">
            {data.label}
          </div>
          <div className="text-[10px] uppercase font-bold tracking-widest text-primary/80 flex flex-col items-center">
            <span>Language Family</span>
            {familySize > 0 && <span className="opacity-80 lowercase mt-0.5">{familySize} {familySize === 1 ? 'language' : 'languages'}</span>}
          </div>
        </Card>
        <Handle type="source" position={Position.Bottom} className="opacity-0" />
      </>
    )
  }

  // make it scale aggressively based on dictionary entries
  // e.g. 1 entry = ~1x, 100 entries = ~1.6x, 10,000 entries = 2.2x
  const scale = 1 + Math.max(0, Math.log10(Math.max(1, count)) * 0.3) + Math.min(0.5, familySize * 0.05);

  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Card 
        style={{ transform: `scale(${scale})` }}
        className="min-w-[140px] p-3 bg-background/80 backdrop-blur-md border border-border/60 hover:border-primary/80 transition-all cursor-pointer group rounded-xl shadow-lg hover:shadow-primary/30"
      >
        <div className="flex flex-col items-center text-center gap-1.5 pointer-events-none">
          <div 
            className="h-10 w-10 relative rounded-full flex items-center justify-center mb-1 group-hover:scale-110 transition-transform"
            style={{ backgroundColor: `${data.color}1a` }} // 1a = 10% opacity
          >
            {data.flagUrl ? (
              <img src={data.flagUrl} alt={data.label} className="w-full h-full object-cover rounded-full shadow-inner relative z-10" />
            ) : (
              <Globe className="h-5 w-5 relative z-10" style={{ color: data.color }} />
            )}
            <div 
              className="absolute inset-0 rounded-full blur-md -z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: `${data.color}4d` }} // 4d = 30% opacity
            ></div>
          </div>
          
          <div className="flex flex-col items-center">
            <div 
              className="font-serif font-bold text-lg leading-tight transition-colors text-foreground"
              style={{ '--hover-color': data.color } as React.CSSProperties}
            >
              <span className="group-hover:[color:var(--hover-color)] transition-colors">{data.label}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full mt-1">
            <BookOpen className="h-3 w-3" style={{ color: `${data.color}b3` }} />
            <span>{data.count}</span>
            {familySize > 0 && (
              <>
                <span className="opacity-30">|</span>
                <Globe className="h-3 w-3" style={{ color: `${data.color}b3` }} />
                <span>{familySize}</span>
              </>
            )}
          </div>
        </div>
      </Card>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </>
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
  const [searchQuery, setSearchQuery] = useState("")
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const { nodes, edges } = useMemo(() => {
    const nds: Node[] = []
    const eds: Edge[] = []
    
    // We want a cool constellation layout.
    // 1. Determine resolved parents
    const languageByName = new Map(languages.map(l => [l.name, l]))
    
    // Resolve parents conceptually to either explicit parent OR existing language matching externalAncestry OR new virtual externalAncestry
    const getResolvedParentId = (l: LanguageData) => {
      if (l.parentLanguageId) return l.parentLanguageId;
      if (l.externalAncestry) {
        const actualParent = languageByName.get(l.externalAncestry);
        if (actualParent && actualParent.id !== l.id) return actualParent.id; // avoid self-loop
        return `virtual-${l.externalAncestry}`;
      }
      return null;
    };

    const virtualRootsMap = new Map<string, any>()
    languages.forEach(l => {
      if (!l.parentLanguageId && l.externalAncestry) {
        const actualParent = languageByName.get(l.externalAncestry);
        if (!actualParent && !virtualRootsMap.has(l.externalAncestry)) {
          virtualRootsMap.set(l.externalAncestry, {
            id: `virtual-${l.externalAncestry}`,
            name: l.externalAncestry,
            slug: "",
            flagUrl: null,
            parentLanguageId: null,
            isVirtual: true,
            owner: { name: "Canonical Ancestry" },
            _count: { dictionaryEntries: 0 }
          })
        }
      }
    })

    const allAvailableNodes = [...languages, ...Array.from(virtualRootsMap.values())];
    
    // Map out children
    const childrenMap = new Map<string, any[]>();
    allAvailableNodes.forEach(node => childrenMap.set(node.id, []));
    languages.forEach(l => {
      const pid = getResolvedParentId(l);
      if (pid) childrenMap.get(pid)?.push(l);
    });

    // Compute family size (full descendant tree size) for scaling
    const familySizeMap = new Map<string, number>();
    const computeFamilySize = (nodeId: string): number => {
      let size = childrenMap.get(nodeId)?.length || 0;
      (childrenMap.get(nodeId) || []).forEach(child => {
        size += computeFamilySize(child.id);
      });
      familySizeMap.set(nodeId, size);
      return size;
    };

    // Roots are nodes that have no parent (virtuals or true independent roots)
    const trueRoots = allAvailableNodes.filter(n => n.isVirtual || getResolvedParentId(n) === null);
    trueRoots.forEach(r => computeFamilySize(r.id));
    
    // Place roots using Vogel's Spiral layout for a denser format
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    const spread = 350 // Scaling factor for spread
    
    trueRoots.forEach((root, i) => {
      // Color coding per family
      const color = root.isVirtual 
        ? FAMILY_COLORS[i % FAMILY_COLORS.length]
        : FAMILY_COLORS[(i + 3) % FAMILY_COLORS.length] // offset real roots slightly

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
          count: root._count?.dictionaryEntries || 0,
          flagUrl: root.flagUrl,
          ownerName: root.owner?.name,
          isVirtual: root.isVirtual,
          familySize: familySizeMap.get(root.id) || 0,
          color,
        },
      })
      
      // BFS to place daughters in concentric circles around their parent
      let queue = [{ node: root, x, y, level: 1, familyName: root.name, color }]
      while (queue.length > 0) {
        const { node: parent, x: px, y: py, level, familyName, color: nodeColor } = queue.shift()!
        
        const daughters = childrenMap.get(parent.id) || [];
        const dRadius = 240 + level * 60
        
        daughters.forEach((d, di) => {
          const arcSweep = daughters.length > 6 ? Math.PI * 1.5 : Math.PI; // Wider arc when many daughters are present
          const spreadAngle = daughters.length > 1 ? arcSweep / Math.max(daughters.length - 1, 1) : 0
          const startAngle = (Math.PI / 4) * level - spreadAngle * (daughters.length - 1) / 2
          const dAngle = daughters.length === 1 ? (Math.PI / 4) * level : startAngle + spreadAngle * di
          const dx = px + Math.cos(dAngle) * dRadius
          const dy = py + Math.sin(dAngle) * dRadius
          
          nds.push({
            id: d.id,
            type: "universeNode",
            position: { x: dx, y: dy },
            data: {
              label: d.name,
              slug: d.slug,
              count: d._count?.dictionaryEntries || 0,
              flagUrl: d.flagUrl,
              ownerName: d.owner?.name,
              familyName: parent.name === familyName ? familyName : `${familyName} ➔ ${parent.name}`,
              familySize: familySizeMap.get(d.id) || 0,
              color: nodeColor,
            },
          })
          
          eds.push({
            id: `e-${parent.id}-${d.id}`,
            source: parent.id,
            target: d.id,
            type: "straight",
            animated: true,
            style: { stroke: nodeColor, strokeWidth: 1.5, strokeDasharray: parent.isVirtual ? "4 4" : "none", opacity: 0.5 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: nodeColor,
              width: 15,
              height: 15,
            },
          })
          
          queue.push({ node: d, x: dx, y: dy, level: level + 1, familyName, color: nodeColor })
        })
      }
    })
    
    return { nodes: nds, edges: eds }
  }, [languages])

  if (languages.length === 0) return null

  // Search filter
  const matchingNodeIds = searchQuery.trim()
    ? nodes.filter(n => n.data.label?.toLowerCase().includes(searchQuery.toLowerCase())).map(n => n.id)
    : []

  const displayNodes = searchQuery.trim()
    ? nodes.map(n => ({
        ...n,
        style: {
          ...n.style,
          opacity: matchingNodeIds.includes(n.id) ? 1 : 0.2,
          transition: "opacity 0.2s ease",
        },
      }))
    : nodes

  const handleFocusMatch = () => {
    if (matchingNodeIds.length === 0 || !reactFlowInstance) return
    const targetNode = nodes.find(n => n.id === matchingNodeIds[0])
    if (targetNode) {
      reactFlowInstance.setCenter(targetNode.position.x, targetNode.position.y, {
        zoom: 1.2,
        duration: 800,
      })
    }
  }

  return (
    <div className="w-full h-full bg-secondary/20 relative rounded-3xl border border-border/50 overflow-hidden shadow-inner inset-shadow">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-background/0 via-background/40 to-background z-10" />
      
      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        onInit={setReactFlowInstance}
        onNodeClick={(_, node) => router.push(`/lang/${node.data.slug}`)}
        className="[&_.react-flow__pane]:cursor-grab [&_.react-flow__pane:active]:cursor-grabbing"
        minZoom={0.05}
        maxZoom={1.5}
        elementsSelectable={true}
        nodesConnectable={false}
        nodesDraggable={false}
        panOnScroll={true}
        zoomOnScroll={false}
        zoomOnPinch={true}
        preventScrolling={false}
        onlyRenderVisibleElements={true} // Boosts performance when zoomed in
      >
        <Background color="hsl(var(--muted-foreground)/0.2)" gap={32} size={1} />
        <Controls showInteractive={false} className="z-20 bg-background/80 backdrop-blur-sm border-border fill-foreground" />
        <MiniMap 
          className="z-20 bg-background/80 backdrop-blur-sm border-border"
          maskColor="hsl(var(--background)/0.6)"
          nodeColor="hsl(var(--primary)/0.5)"
          position="bottom-right"
        />
      </ReactFlow>
      
      {/* Search overlay & Legend */}
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
              {matchingNodeIds.length > 0 && reactFlowInstance && (
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
            Scroll to pan • Ctrl+Scroll to zoom • Click/Touch to explore
          </p>
        </div>
      </div>
    </div>
  )
}
