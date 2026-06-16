"use client"

import { SectionError } from "@/components/feedback/section-error"

export default function StudioError(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <SectionError {...props} />
}
