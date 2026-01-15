"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface CopyButtonProps {
    value: string
    label?: string
    className?: string
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className={cn("h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground", className)}
            title={`Copy ${label || value}`}
        >
            {copied ? (
                <Check className="h-3 w-3 text-green-500" />
            ) : (
                <Copy className="h-3 w-3" />
            )}
            {label && <span className="text-xs">{label}</span>}
        </Button>
    )
}
