import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * A settings card's outline while its code loads. Only seen on a client-side navigation before
 * the card's chunk is cached: on a full page load the server-rendered card stays in place.
 */
export function SettingsCardSkeleton({ className }: { className?: string }) {
  return (
    <Card aria-busy="true" className={cn("space-y-4 p-6", className)}>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="h-10 w-full" />
    </Card>
  )
}
