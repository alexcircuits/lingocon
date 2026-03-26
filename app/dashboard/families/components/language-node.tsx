import { memo } from "react"
import { Handle, Position } from "reactflow"
import { Card } from "@/components/ui/card"
import { Crown, BookOpen, ExternalLink, BookCopy } from "lucide-react"
import { cn } from "@/lib/utils"

interface LanguageNodeProps {
  data: {
    label: string
    slug: string
    count: number
    isRoot: boolean
    isReadOnly?: boolean
    hasChildren?: boolean
    owner?: { id: string; name: string | null; image: string | null }
    onDeriveWords?: () => void
  }
  selected: boolean
}

export const LanguageNode = memo(({ data, selected }: LanguageNodeProps) => {
  return (
    <Card className={cn(
      "min-w-[180px] p-4 bg-card cursor-grab active:cursor-grabbing border-2 transition-colors relative group",
      selected ? "border-primary ring-4 ring-primary/20" : "border-border hover:border-border/80"
    )}>
      {/* Target handle (can be connected TO) */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={!data.isReadOnly}
        className={cn(
          "w-3 h-3 rounded-full border-2 border-background transition-colors",
          data.isRoot ? "bg-muted hover:bg-muted-foreground" : "bg-primary"
        )}
      />

      <div className="flex flex-col items-center text-center gap-2">
        {data.isReadOnly && data.owner ? (
          <div className="h-8 w-8 rounded-full overflow-hidden border border-border/50 -mt-1 mb-1 shadow-sm">
            {data.owner.image ? (
              <img src={data.owner.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {data.owner.name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
          </div>
        ) : data.isRoot ? (
          <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center -mt-1 mb-1 ring-1 ring-amber-500/20">
            <Crown className="h-4 w-4 text-amber-500" />
          </div>
        ) : (
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center -mt-1 mb-1">
            <span className="text-xs font-serif font-bold text-primary">
              {data.label.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        
        <div className="font-serif font-medium text-lg leading-tight group-hover:text-primary transition-colors">
          {data.label}
        </div>
        
        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-md mt-1">
          <BookOpen className="h-3 w-3" />
          <span>{data.count} words</span>
        </div>

        {/* Action links */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 mt-0.5">
          {data.slug && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                window.open(`/studio/lang/${data.slug}`, "_blank")
              }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              Studio
            </button>
          )}
          {data.hasChildren && data.onDeriveWords && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                data.onDeriveWords?.()
              }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-emerald-500 transition-colors"
            >
              <BookCopy className="h-2.5 w-2.5" />
              Derive
            </button>
          )}
        </div>
      </div>

      {/* Source handle (can connect FROM) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-primary rounded-full border-2 border-background hover:bg-primary/80 transition-colors"
      />
    </Card>
  )
})

LanguageNode.displayName = "LanguageNode"
