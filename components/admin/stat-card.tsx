import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface StatCardProps {
    title: string
    value: string | number
    description?: string
    icon: LucideIcon
    trend?: {
        value: number
        label: string
    }
    className?: string
}

export function StatCard({
    title,
    value,
    description,
    icon: Icon,
    trend,
    className
}: StatCardProps) {
    const isPositive = trend && trend.value > 0
    const isNegative = trend && trend.value < 0

    return (
        <div
            className={cn(
                "rounded-xl border border-border/50 bg-card p-5 transition-colors hover:border-border",
                className
            )}
        >
            <div className="flex items-center justify-between">
                <div className="rounded-lg bg-primary/10 p-2.5">
                    <Icon className="h-5 w-5 text-primary" />
                </div>
                {trend && (
                    <span
                        className={cn(
                            "text-xs font-medium rounded-full px-2 py-1",
                            isPositive && "bg-green-500/10 text-green-600",
                            isNegative && "bg-red-500/10 text-red-600",
                            !isPositive && !isNegative && "bg-muted text-muted-foreground"
                        )}
                    >
                        {isPositive && "+"}
                        {trend.value} {trend.label}
                    </span>
                )}
            </div>
            <div className="mt-4">
                <p className="text-3xl font-serif font-medium tracking-tight">{value}</p>
                <p className="text-sm text-muted-foreground mt-1">{title}</p>
                {description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                )}
            </div>
        </div>
    )
}
