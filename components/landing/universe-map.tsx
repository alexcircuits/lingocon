"use client"

import { useMemo } from "react"
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Node,
  MarkerType,
  Handle,
  Position
} from "reactflow"
import "reactflow/dist/style.css"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Globe, BookOpen, Sparkles } from "lucide-react"

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
          <div className="h-10 w-10 relative rounded-full bg-primary/20 flex items-center justify-center mb-1">
            <Sparkles className="h-5 w-5 text-primary relative z-10" />
            <div className="absolute inset-0 rounded-full bg-primary/40 blur-md -z-10 animate-pulse"></div>
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

  // real languages scale from both entries and family size
  const entryScale = Math.min(0.4, Math.log10(Math.max(1, count)) * 0.1);
  const familyScale = Math.min(0.8, Math.log10(Math.max(1, familySize)) * 0.3);
  const scale = 1 + entryScale + familyScale;

  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Card 
        style={{ transform: `scale(${scale})` }}
        className="min-w-[140px] p-3 bg-background/80 backdrop-blur-md border border-border/60 hover:border-primary/80 transition-all cursor-pointer group rounded-xl shadow-lg hover:shadow-primary/30"
      >
        <div className="flex flex-col items-center text-center gap-1.5 pointer-events-none">
          <div className="h-10 w-10 relative rounded-full bg-primary/10 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
            {data.flagUrl ? (
              <img src={data.flagUrl} alt={data.label} className="w-full h-full object-cover rounded-full shadow-inner relative z-10" />
            ) : (
              <Globe className="h-5 w-5 text-primary relative z-10" />
            )}
            <div className="absolute inset-0 rounded-full bg-primary/30 blur-md -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="font-serif font-bold text-base leading-tight group-hover:text-primary transition-colors text-foreground">
              {data.label}
            </div>
            {data.familyName && (
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground/80 mt-1 max-w-[120px] truncate">
                {data.familyName}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full mt-1">
            <BookOpen className="h-3 w-3 text-primary/70" />
            <span>{data.count}</span>
            {familySize > 0 && (
              <>
                <span className="opacity-30">|</span>
                <Globe className="h-3 w-3 text-primary/70" />
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
        },
      })
      
      // BFS to place daughters in concentric circles around their parent
      let queue = [{ node: root, x, y, level: 1, familyName: root.name }]
      while (queue.length > 0) {
        const { node: parent, x: px, y: py, level, familyName } = queue.shift()!
        
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
          
          queue.push({ node: d, x: dx, y: dy, level: level + 1, familyName })
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
