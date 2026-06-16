import { Skeleton } from "@/components/ui/skeleton"

interface PageSkeletonProps {
  /** Number of card placeholders to render in the grid. */
  cards?: number
}

/**
 * Generic content skeleton for a route segment's `loading.tsx`. Renders inside
 * the section layout (header + card grid) rather than as a full-screen overlay,
 * so navigation within a section shows a structural placeholder, not a blank page.
 */
export function PageSkeleton({ cards = 6 }: PageSkeletonProps) {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  )
}
