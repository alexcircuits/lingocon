"use client"

import { SectionError } from "@/components/feedback/section-error"

export default function DashboardError(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <SectionError {...props} />
}
