import { PageSkeleton } from "@/components/feedback/page-skeleton"

/**
 * Skeleton while this section loads. Loading boundaries sit on list and leaf pages
 * only, never above a page that can be missing (grammar pages, articles, texts) or
 * above the language layout: a page's notFound() inside a boundary is sent as
 * HTTP 200 because streaming has already started.
 */
export default function LangSectionLoading() {
  return <PageSkeleton />
}
