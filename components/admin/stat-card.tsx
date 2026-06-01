import { cn } from "@/lib/utils"
import { LucideIcon, TrendingDown, TrendingUp, Minus } from "lucide-react"

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
    const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus

    return (
        <div
            className={cn(
                "group rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-border hover:shadow-sm",
                className
            )}
        >
            <div className="flex items-center justify-between">
                <div className="rounded-lg bg-primary/10 p-2.5 transition-colors group-hover:bg-primary/15">
                    <Icon className="h-5 w-5 text-primary" />
                </div>
                {trend && (
                    <span
                        className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
                            isPositive && "bg-green-500/10 text-green-600 dark:text-green-400",
                            isNegative && "bg-red-500/10 text-red-600 dark:text-red-400",
                            !isPositive && !isNegative && "bg-muted text-muted-foreground"
                        )}
                    >
                        <TrendIcon className="h-3 w-3" />
                        {isPositive && "+"}
                        {trend.value.toLocaleString()}
                        <span className="font-normal opacity-80">{trend.label}</span>
                    </span>
                )}
            </div>
            <div className="mt-4">
                <p className="text-3xl font-serif font-medium tracking-tight tabular-nums">{value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{title}</p>
                {description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                )}
            </div>
        </div>
    )
}
