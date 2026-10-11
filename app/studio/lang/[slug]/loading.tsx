import { PageSkeleton } from "@/components/feedback/page-skeleton"

/**
 * Rendered inside the studio shell (sidebar and header stay put) while a tool's
 * server component loads. Without a boundary below the shared `[slug]` layout,
 * router prefetches carry no fallback and every tab click waits for the full
 * server render with no visual response.
 */
export default function StudioToolLoading() {
  return <PageSkeleton />
}
