"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Client-side lazy entry points for the chart components. `next/dynamic` only
 * splits code when it is called from a client module; called from the server
 * overview page, the charting library still landed in that route's first-load
 * bundle.
 */
function ChartSkeleton({ className }: { className: string }) {
  return <Skeleton className={className} />
}

export const LazyActivityChart = dynamic(
  () => import("@/components/analytics/activity-chart").then((mod) => mod.ActivityChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-[300px] w-full rounded-xl" /> }
)

export const LazyPosDistributionChart = dynamic(
  () => import("@/components/analytics/pos-distribution-chart").then((mod) => mod.PosDistributionChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-[300px] w-full rounded-xl" /> }
)
