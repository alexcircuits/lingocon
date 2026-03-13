"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  Panel,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow"
import "reactflow/dist/style.css"
import { LanguageNode } from "./language-node"
import { VirtualNode } from "./virtual-node"
import { TreeStats } from "./tree-stats"
import { CompareModal } from "./compare-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Save, Plus, ArrowRight, X, Undo2, Redo2, Search, Focus, GitCompareArrows } from "lucide-react"
import { toast } from "sonner"
import { setParentLanguage } from "@/app/actions/language-family"
import { useRouter } from "next/navigation"

interface LanguageData {
  id: string
  name: string
  slug: string
  parentLanguageId: string | null
  externalAncestry: string | null
  ownerId: string
  owner?: { id: string; name: string | null; image: string | null }
  _count: {
    dictionaryEntries: number
  }
}

interface LanguageFamilyBuilderProps {
  initialLanguages: LanguageData[]
  currentUserId: string
}

const nodeTypes = {
  languageNode: LanguageNode,
  virtualNode: VirtualNode,
}

const NODE_WIDTH = 220
const NODE_HEIGHT = 100
const H_GAP = 40
const V_GAP = 120
const TREE_GAP = 120

/**
 * Proper hierarchical tree layout.
 * 1. Build adjacency map  2. Find roots  3. DFS to measure subtree widths
 * 4. DFS again to assign positions  5. Separate independent trees horizontally
 */
function getInitialNodesAndEdges(languages: LanguageData[], currentUserId: string) {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Create virtual nodes for unique external ancestries
  const virtualMap = new Map<string, string>() // ancestryName -> virtualId
  languages.forEach((l) => {
    if (!l.parentLanguageId && l.externalAncestry && !virtualMap.has(l.externalAncestry)) {
      virtualMap.set(l.externalAncestry, `virtual-${encodeURIComponent(l.externalAncestry)}`)
    }
  })

  // Combine real languages and virtual nodes
  const byId = new Map(languages.map(l => [l.id, l as LanguageData & { isVirtual?: boolean }]))
  
  virtualMap.forEach((virtualId, ancestryName) => {
    byId.set(virtualId, {
      id: virtualId,
      name: ancestryName,
      slug: "",
      parentLanguageId: null,
      externalAncestry: null,
      ownerId: "system", // read only
      _count: { dictionaryEntries: 0 },
      isVirtual: true
    } as any)
  })

  // Build children map
  const childrenMap = new Map<string, string[]>()
  byId.forEach((_, id) => childrenMap.set(id, []))

  // Populate children map
  languages.forEach(l => {
    if (l.parentLanguageId && childrenMap.has(l.parentLanguageId)) {
      childrenMap.get(l.parentLanguageId)!.push(l.id)
    } else if (!l.parentLanguageId && l.externalAncestry && virtualMap.has(l.externalAncestry)) {
      childrenMap.get(virtualMap.get(l.externalAncestry)!)!.push(l.id)
    }
  })

  // Sort children alphabetically by name for consistent ordering
  childrenMap.forEach((kids, _parentId) => {
    kids.sort((a, b) => {
      const nameA = byId.get(a)?.name || ""
      const nameB = byId.get(b)?.name || ""
      return nameA.localeCompare(nameB)
    })
  })

  const roots = Array.from(byId.values()).filter(l => {
    if (l.isVirtual) return true;
    if (l.parentLanguageId) return false;
    if (l.externalAncestry && virtualMap.has(l.externalAncestry)) return false;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name))

  // Count leaf-width of each subtree (min 1)
  const subtreeWidth = new Map<string, number>()
  function measureWidth(id: string): number {
    const kids = childrenMap.get(id) || []
    if (kids.length === 0) {
      subtreeWidth.set(id, 1)
      return 1
    }
    const w = kids.reduce((sum, kid) => sum + measureWidth(kid), 0)
    subtreeWidth.set(id, w)
    return w
  }

  // Assign positions with DFS
  function layoutTree(rootId: string, offsetX: number) {
    measureWidth(rootId)

    function place(id: string, depth: number, leftX: number) {
      const lang = byId.get(id)!;
      const w = subtreeWidth.get(id) || 1
      const x = leftX + (w * (NODE_WIDTH + H_GAP)) / 2 - NODE_WIDTH / 2
      const y = depth * (NODE_HEIGHT + V_GAP)
      const isRoot = depth === 0

      nodes.push({
        id: lang.id,
        type: lang.isVirtual ? "virtualNode" : "languageNode",
        position: { x, y },
        draggable: lang.ownerId === currentUserId, // only drag my own
        deletable: false, // Prevent node deletion entirely
        data: {
          label: lang.name,
          slug: lang.slug,
          count: lang._count.dictionaryEntries,
          isRoot,
          isReadOnly: lang.ownerId !== currentUserId,
          owner: lang.owner,
        },
      })

      // Add edges for children
      let childLeft = leftX
      for (const kid of childrenMap.get(id) || []) {
        const kidLang = byId.get(kid)!;
        const isKidReadOnly = kidLang.ownerId !== currentUserId;
        
        edges.push({
          id: `e-${id}-${kid}`,
          source: id,
          target: kid,
          animated: true,
          label: "evolved",
          labelStyle: { fontSize: 10, fill: "hsl(var(--muted-foreground))", fontStyle: "italic" },
          labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.8 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          deletable: !isKidReadOnly,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "hsl(var(--primary))",
          },
        })

        const kidW = subtreeWidth.get(kid) || 1
        place(kid, depth + 1, childLeft)
        childLeft += kidW * (NODE_WIDTH + H_GAP)
      }
    }

    place(rootId, 0, offsetX)
    return (subtreeWidth.get(rootId) || 1) * (NODE_WIDTH + H_GAP)
  }

  let cursor = 0
  roots.forEach(root => {
    const usedWidth = layoutTree(root.id, cursor)
    cursor += usedWidth + TREE_GAP
  })

  return { nodes, edges }
}

function LanguageFamilyBuilderInner({ initialLanguages, currentUserId }: LanguageFamilyBuilderProps) {
  const router = useRouter()
  const reactFlowInstance = useReactFlow()
  const { nodes: initNodes, edges: initEdges } = useMemo(() => getInitialNodesAndEdges(initialLanguages, currentUserId), [initialLanguages, currentUserId])
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)
  
  const [isSaving, setIsSaving] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<{ id: string; parentId: string | null }[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showCompare, setShowCompare] = useState(false)

  // Undo/Redo stack
  type Snapshot = { edges: Edge[]; nodes: Node[]; pending: { id: string; parentId: string | null }[] }
  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const pushUndo = useCallback(() => {
    undoStack.current.push({ edges: [...edges], nodes: [...nodes], pending: [...pendingChanges] })
    redoStack.current = []
    setCanUndo(true)
    setCanRedo(false)
  }, [edges, nodes, pendingChanges])

  const handleUndo = useCallback(() => {
    const snapshot = undoStack.current.pop()
    if (!snapshot) return
    redoStack.current.push({ edges: [...edges], nodes: [...nodes], pending: [...pendingChanges] })
    setEdges(snapshot.edges)
    setNodes(snapshot.nodes)
    setPendingChanges(snapshot.pending)
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(true)
  }, [edges, nodes, pendingChanges, setEdges, setNodes])

  const handleRedo = useCallback(() => {
    const snapshot = redoStack.current.pop()
    if (!snapshot) return
    undoStack.current.push({ edges: [...edges], nodes: [...nodes], pending: [...pendingChanges] })
    setEdges(snapshot.edges)
    setNodes(snapshot.nodes)
    setPendingChanges(snapshot.pending)
    setCanUndo(true)
    setCanRedo(redoStack.current.length > 0)
  }, [edges, nodes, pendingChanges, setEdges, setNodes])

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault()
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleUndo, handleRedo])

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      // Prevent connecting a node to itself
      if (params.source === params.target) return

      // Save snapshot for undo before making changes
      pushUndo()
      
      const newEdge = {
        id: `e-${params.source}-${params.target}`,
        source: params.source!,
        target: params.target!,
        sourceHandle: params.sourceHandle ?? undefined,
        targetHandle: params.targetHandle ?? undefined,
        animated: true,
        label: "evolved",
        labelStyle: { fontSize: 10, fill: "hsl(var(--muted-foreground))", fontStyle: "italic" },
        labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.8 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "hsl(var(--primary))",
        },
      }
      
      // Use functional updater to avoid stale closure
      setEdges((eds) => {
        // Remove existing parent connection for this target (a language can only have one parent)
        const filtered = eds.filter(e => e.target !== params.target)
        return [...filtered, newEdge]
      })
      
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
    [setEdges, setNodes, pushUndo]
  )
  
  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    // Save snapshot for undo before deleting
    pushUndo()
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
  }, [setNodes, pushUndo])

  const handleSave = async () => {
    if (pendingChanges.length === 0) {
      toast.info("No connections changed")
      return
    }
    
    setIsSaving(true)
    const applied: string[] = []
    
    // Process changes sequentially to handle circular references safely
    for (const change of pendingChanges) {
      const res = await setParentLanguage(change.id, change.parentId)
      if (res?.error) {
        toast.error(`Could not connect: ${res.error}`)
        // Stop on first error — already-applied changes are committed
        break
      }
      applied.push(change.id)
    }
    
    // Remove only successfully applied changes from pending
    setPendingChanges(prev => prev.filter(p => !applied.includes(p.id)))
    setIsSaving(false)
    
    if (applied.length > 0) {
      toast.success(`Saved ${applied.length} of ${pendingChanges.length} changes`)
      router.refresh()
    }
  }

  if (initialLanguages.length === 0) {
    return (
      <div className="w-full h-full bg-secondary/10 flex items-center justify-center">
        <div className="text-center space-y-3 max-w-md px-6">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Plus className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-serif text-xl font-medium">No languages yet</h2>
          <p className="text-sm text-muted-foreground">
            Create your first language in the dashboard, then come back here to build family trees by connecting ancestors to their daughter languages.
          </p>
        </div>
      </div>
    )
  }

  // Search: highlight matching nodes
  const matchingNodeIds = searchQuery.trim()
    ? nodes.filter(n => n.data.label?.toLowerCase().includes(searchQuery.toLowerCase())).map(n => n.id)
    : []

  const displayNodes = searchQuery.trim()
    ? nodes.map(n => ({
        ...n,
        style: {
          ...n.style,
          opacity: matchingNodeIds.includes(n.id) ? 1 : 0.3,
          transition: "opacity 0.2s ease",
        },
      }))
    : nodes

  const handleFocusMatch = () => {
    if (matchingNodeIds.length === 0) return
    const targetNode = nodes.find(n => n.id === matchingNodeIds[0])
    if (targetNode) {
      reactFlowInstance.setCenter(targetNode.position.x + NODE_WIDTH / 2, targetNode.position.y + NODE_HEIGHT / 2, {
        zoom: 1.2,
        duration: 500,
      })
    }
  }

  return (
    <div className="w-full h-full bg-secondary/10 relative">
      <ReactFlow
        nodes={displayNodes}
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
          className="bg-background border border-border rounded-lg shadow-sm !hidden sm:!block"
          maskColor="hsl(var(--secondary))"
          nodeColor="hsl(var(--primary))"
        />
        
        <Panel position="top-right" className="m-2 sm:m-4">
          <div className="bg-card/80 backdrop-blur-md border border-border/50 p-2.5 sm:p-4 rounded-xl shadow-lg flex flex-col gap-2 sm:gap-3 w-[180px] sm:w-auto sm:min-w-[250px] max-h-[calc(100vh-120px)] overflow-y-auto">
            <div>
              <h2 className="font-serif text-sm sm:text-lg font-medium">Family Builder</h2>
              <p className="text-xs text-muted-foreground hidden sm:block">
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

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={!canUndo || isSaving}
                className="flex-1 gap-1.5 text-xs"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRedo}
                disabled={!canRedo || isSaving}
                className="flex-1 gap-1.5 text-xs"
              >
                <Redo2 className="h-3.5 w-3.5" />
                Redo
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search languages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            {searchQuery.trim() && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{matchingNodeIds.length} match{matchingNodeIds.length !== 1 ? "es" : ""}</span>
                {matchingNodeIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleFocusMatch}
                    className="h-6 gap-1 text-xs px-2"
                  >
                    <Focus className="h-3 w-3" />
                    Focus
                  </Button>
                )}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCompare(true)}
              className="w-full gap-1.5 text-xs"
              disabled={initialLanguages.length < 2}
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              Compare Languages
            </Button>
          </div>
        </Panel>
      </ReactFlow>

      {/* Stats Panel — bottom left, hidden on mobile */}
      <div className="absolute bottom-4 left-4 z-10 hidden sm:block">
        <div className="bg-card/80 backdrop-blur-md border border-border/50 p-3 rounded-xl shadow-lg min-w-[200px]">
          <TreeStats languages={initialLanguages} />
        </div>
      </div>

      <CompareModal
        languages={initialLanguages}
        isOpen={showCompare}
        onClose={() => setShowCompare(false)}
      />
    </div>
  )
}

export function LanguageFamilyBuilder(props: LanguageFamilyBuilderProps) {
  return (
    <ReactFlowProvider>
      <LanguageFamilyBuilderInner {...props} />
    </ReactFlowProvider>
  )
}
