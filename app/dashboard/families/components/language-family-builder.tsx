"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Panel,
  MarkerType,
} from "reactflow"
import "reactflow/dist/style.css"
import { LanguageNode } from "./language-node"
import { Button } from "@/components/ui/button"
import { Save, Plus, ArrowRight, X } from "lucide-react"
import { toast } from "sonner"
import { setParentLanguage } from "@/app/actions/language-family"
import { useRouter } from "next/navigation"

interface LanguageData {
  id: string
  name: string
  slug: string
  parentLanguageId: string | null
  _count: {
    dictionaryEntries: number
  }
}

interface LanguageFamilyBuilderProps {
  initialLanguages: LanguageData[]
}

const nodeTypes = {
  languageNode: LanguageNode,
}

// Helper to auto-layout the languages into a tree visually if they don't have saved positions
// For MVP, we'll just stack them roughly, or trust the user to drag them.
function getInitialNodesAndEdges(languages: LanguageData[]) {
  const nodes: Node[] = []
  const edges: Edge[] = []
  
  // Basic layout state
  const levelCounts: Record<string, number> = {}
  
  languages.forEach((lang, i) => {
    // If it's a root (no parent), put it high up
    const isRoot = !lang.parentLanguageId
    const yPos = isRoot ? 50 : 250
    const xPos = (i * 250) % 1000

    nodes.push({
      id: lang.id,
      type: "languageNode",
      position: { x: xPos, y: yPos },
      data: {
        label: lang.name,
        slug: lang.slug,
        count: lang._count.dictionaryEntries,
        isRoot,
      },
    })
    
    if (lang.parentLanguageId) {
      edges.push({
        id: `e-${lang.parentLanguageId}-${lang.id}`,
        source: lang.parentLanguageId,
        target: lang.id,
        animated: true,
        style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "hsl(var(--primary))",
        },
      })
    }
  })
  
  return { nodes, edges }
}

export function LanguageFamilyBuilder({ initialLanguages }: LanguageFamilyBuilderProps) {
  const router = useRouter()
  const { nodes: initNodes, edges: initEdges } = useMemo(() => getInitialNodesAndEdges(initialLanguages), [initialLanguages])
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)
  
  const [isSaving, setIsSaving] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<{ id: string; parentId: string | null }[]>([])

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      // Prevent connecting a node to itself
      if (params.source === params.target) return
      
      // Prevent multiple parents (a language can only have one parentLanguageId)
      // Check if target already has an incoming edge
      const hasParent = edges.some(e => e.target === params.target)
      let newEdges = edges
      
      if (hasParent) {
        // Remove existing parent connection for this target
        newEdges = edges.filter(e => e.target !== params.target)
      }
      
      const edge = {
        ...params,
        id: `e-${params.source}-${params.target}`,
        animated: true,
        style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "hsl(var(--primary))",
        },
      }
      
      setEdges((eds) => addEdge(edge, newEdges))
      
      // Track that we need to save this to DB
      setPendingChanges(prev => {
        const filtered = prev.filter(p => p.id !== params.target)
        return [...filtered, { id: params.target as string, parentId: params.source as string }]
      })
      
      // Update node visual state (no longer root)
      setNodes(nds => nds.map(n => {
        if (n.id === params.target) {
          return { ...n, data: { ...n.data, isRoot: false } }
        }
        return n
      }))
    },
    [edges, setEdges, setNodes]
  )
  
  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    deleted.forEach(edge => {
      // Track that we need to remove parent from DB
      setPendingChanges(prev => {
        const filtered = prev.filter(p => p.id !== edge.target)
        return [...filtered, { id: edge.target as string, parentId: null }]
      })
      
      // Target is now a root
      setNodes(nds => nds.map(n => {
        if (n.id === edge.target) {
          return { ...n, data: { ...n.data, isRoot: true } }
        }
        return n
      }))
    })
  }, [setNodes])

  const handleSave = async () => {
    if (pendingChanges.length === 0) {
      toast.info("No connections changed")
      return
    }
    
    setIsSaving(true)
    let hasError = false
    
    // Process changes sequentially to handle circular references safely
    for (const change of pendingChanges) {
      const res = await setParentLanguage(change.id, change.parentId)
      if (res?.error) {
        toast.error(`Could not connect: ${res.error}`)
        hasError = true
      }
    }
    
    setIsSaving(false)
    if (!hasError) {
      toast.success("Family tree updated successfully!")
      setPendingChanges([])
      router.refresh()
    }
  }

  return (
    <div className="w-full h-full bg-secondary/10 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
        className="touch-none"
        minZoom={0.2}
      >
        <Background color="hsl(var(--muted-foreground))" gap={16} size={1} />
        <Controls className="bg-background border-border fill-foreground" />
        <MiniMap 
          className="bg-background border border-border rounded-lg shadow-sm"
          maskColor="hsl(var(--secondary))"
          nodeColor="hsl(var(--primary))"
        />
        
        <Panel position="top-right" className="m-4">
          <div className="bg-card/80 backdrop-blur-md border border-border/50 p-4 rounded-xl shadow-lg flex flex-col gap-3 min-w-[250px]">
            <div>
              <h2 className="font-serif text-lg font-medium">Family Builder</h2>
              <p className="text-xs text-muted-foreground">
                Drag handles to connect ancestors to daughters. Select an edge and press Backspace to sever the connection.
              </p>
            </div>
            
            <Button 
              onClick={handleSave} 
              disabled={isSaving || pendingChanges.length === 0}
              className="w-full gap-2 transition-all"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : `Save Tree (${pendingChanges.length} changes)`}
            </Button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}
