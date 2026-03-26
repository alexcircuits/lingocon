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
import { Save, Plus, ArrowRight, X, Undo2, Redo2, Search, Focus, GitCompareArrows, Network, BookCopy } from "lucide-react"
import { toast } from "sonner"
import { setParentLanguage } from "@/app/actions/language-family"
import { buildFamilyGraph } from "@/lib/utils/family-graph"
import { useRouter } from "next/navigation"
import { DerivationPanel } from "./derivation-panel"

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
  onPendingChangesChange?: (count: number) => void
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
 * Uses shared buildFamilyGraph for graph structure, then applies
 * DFS to measure subtree widths and assign node positions.
 */
function getInitialNodesAndEdges(languages: LanguageData[], currentUserId: string) {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Use shared graph builder for virtual nodes, children map, and root detection
  const graph = buildFamilyGraph(languages)
  const { byId, childrenMap, rootIds } = graph

  // Count leaf-width of each subtree (min 1)
  const subtreeWidth = new Map<string, number>()
  const measuring = new Set<string>()
  function measureWidth(id: string): number {
    if (measuring.has(id)) return 1 // break cycle
    if (subtreeWidth.has(id)) return subtreeWidth.get(id)!

    measuring.add(id)
    const kids = childrenMap.get(id) || []
    if (kids.length === 0) {
      subtreeWidth.set(id, 1)
      measuring.delete(id)
      return 1
    }
    const w = kids.reduce((sum: number, kid: string) => sum + measureWidth(kid), 0)
    const finalW = Math.max(1, w)
    subtreeWidth.set(id, finalW)
    measuring.delete(id)
    return finalW
  }

  const globalPlaced = new Set<string>()

  // Assign positions with DFS
  function layoutTree(rootId: string, offsetX: number) {
    measureWidth(rootId)

    function place(id: string, depth: number, leftX: number) {
      if (globalPlaced.has(id)) return // break cycle or duplicate
      globalPlaced.add(id)

      const lang = byId.get(id)!;
      const w = subtreeWidth.get(id) || 1
      const x = leftX + (w * (NODE_WIDTH + H_GAP)) / 2 - NODE_WIDTH / 2
      const y = depth * (NODE_HEIGHT + V_GAP)
      const isRoot = depth === 0

      const kids = childrenMap.get(id) || []
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
          hasChildren: kids.length > 0,
          owner: lang.owner,
        },
      })

      // Add edges for children
      let childLeft = leftX
      for (const kid of childrenMap.get(id) || []) {
        // Only draw edge if we haven't placed target yet in this pass to prevent looping lines
        if (!globalPlaced.has(kid)) {
          const isKidReadOnly = byId.get(kid)?.ownerId !== currentUserId
          
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
    }

    place(rootId, 0, offsetX)
    return (subtreeWidth.get(rootId) || 1) * (NODE_WIDTH + H_GAP)
  }

  let cursor = 0
  rootIds.forEach(rootId => {
    const usedWidth = layoutTree(rootId, cursor)
    cursor += usedWidth + TREE_GAP
  })

  return { nodes, edges }
}

function LanguageFamilyBuilderInner({ initialLanguages, currentUserId, onPendingChangesChange }: LanguageFamilyBuilderProps) {
  const router = useRouter()
  const reactFlowInstance = useReactFlow()
  const { nodes: initNodes, edges: initEdges } = useMemo(() => getInitialNodesAndEdges(initialLanguages, currentUserId), [initialLanguages, currentUserId])
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)
  
  const [isSaving, setIsSaving] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<{ id: string; parentId: string | null }[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showCompare, setShowCompare] = useState(false)

  // Derivation state
  const [derivation, setDerivation] = useState<{
    sourceId: string
    sourceName: string
    targetId: string
    targetName: string
  } | null>(null)

  // Wire up derive callbacks into node data
  const handleDeriveFromNode = useCallback((nodeId: string) => {
    // Find the first child of this node that the current user owns
    const childEdge = edges.find(e => e.source === nodeId)
    if (!childEdge) return
    const sourceNode = nodes.find(n => n.id === nodeId)
    const targetNode = nodes.find(n => n.id === childEdge.target)
    if (!sourceNode || !targetNode) return

    setDerivation({
      sourceId: nodeId,
      sourceName: sourceNode.data.label,
      targetId: childEdge.target,
      targetName: targetNode.data.label,
    })
  }, [edges, nodes])

  // Update node data to include derive callback
  useEffect(() => {
    setNodes(nds => nds.map(n => ({
      ...n,
      data: {
        ...n.data,
        onDeriveWords: n.data.hasChildren ? () => handleDeriveFromNode(n.id) : undefined,
      },
    })))
  }, [handleDeriveFromNode, setNodes])

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

  // Notify parent about pending changes count
  useEffect(() => {
    onPendingChangesChange?.(pendingChanges.length)
  }, [pendingChanges.length, onPendingChangesChange])

  // Warn about unsaved changes on navigation/tab close
  useEffect(() => {
    if (pendingChanges.length === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [pendingChanges.length])

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

  // Auto-Layout based on current topology (initial + pending changes)
  const handleAutoLayout = useCallback(() => {
    // Reconstruct current language tree state
    const currentLangs = initialLanguages.map(l => ({ ...l }))
    for (const change of pendingChanges) {
      const lang = currentLangs.find(l => l.id === change.id)
      if (lang) {
        lang.parentLanguageId = change.parentId
      }
    }

    // Run layout engine
    const { nodes: autoNodes } = getInitialNodesAndEdges(currentLangs, currentUserId)
    
    // Update node positions smoothly
    setNodes(nds => nds.map(n => {
      const autoNode = autoNodes.find(an => an.id === n.id)
      return autoNode ? { ...n, position: autoNode.position } : n
    }))

    // Refit view
    setTimeout(() => {
      reactFlowInstance.fitView({ duration: 800, padding: 0.2 })
    }, 50)
  }, [initialLanguages, pendingChanges, currentUserId, setNodes, reactFlowInstance])

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
                className="flex-[0.5] gap-1.5 text-xs px-2"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoLayout}
                className="flex-1 gap-1.5 text-xs border-primary/20 bg-primary/5 hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Network className="h-3.5 w-3.5" />
                Auto-Layout
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

            {/* Derive words hint */}
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Click a parent node, then &ldquo;Derive Words&rdquo; to copy words to a child.
            </p>
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

      {/* Derivation side panel */}
      {derivation && (
        <div className="absolute top-0 right-0 bottom-0 w-[340px] z-30 bg-card border-l border-border shadow-lg flex flex-col">
          <DerivationPanel
            sourceLanguageId={derivation.sourceId}
            sourceLanguageName={derivation.sourceName}
            targetLanguageId={derivation.targetId}
            targetLanguageName={derivation.targetName}
            onClose={() => setDerivation(null)}
          />
        </div>
      )}
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
