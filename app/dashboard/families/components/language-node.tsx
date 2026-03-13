import { memo } from "react"
import { Handle, Position } from "reactflow"
import { Card } from "@/components/ui/card"
import { Crown, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

interface LanguageNodeProps {
  data: {
    label: string
    slug: string
    count: number
    isRoot: boolean
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
        className={cn(
          "w-3 h-3 rounded-full border-2 border-background transition-colors",
          data.isRoot ? "bg-muted hover:bg-muted-foreground" : "bg-primary"
        )}
      />

      <div className="flex flex-col items-center text-center gap-2">
        {data.isRoot ? (
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
