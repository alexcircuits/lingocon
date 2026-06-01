import { memo } from "react"
import { Handle, Position } from "reactflow"
import { Card } from "@/components/ui/card"
import { Sparkles } from "lucide-react"

interface VirtualNodeProps {
  data: {
    label: string
  }
}

export const VirtualNode = memo(({ data }: VirtualNodeProps) => {
  return (
    <Card className="min-w-[180px] p-4 bg-background/50 backdrop-blur-sm border-dashed border-2 border-primary/30 rounded-2xl relative flex flex-col items-center justify-center text-center gap-2">
      {/* Target handle — allows connecting languages TO this ancestry node */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="w-3 h-3 rounded-full border-2 border-background bg-muted"
      />
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mb-1">
        <Sparkles className="h-4 w-4 text-primary/60" />
      </div>
      <div className="italic font-semibold text-lg leading-tight text-muted-foreground">
        {data.label}
      </div>
      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/50">
        Shared Ancestry
      </div>
      {/* Source handle (can connect FROM) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-border rounded-full border-2 border-background"
        isConnectable={false} // Purely visual in the builder
      />
    </Card>
  )
})

VirtualNode.displayName = "VirtualNode"
