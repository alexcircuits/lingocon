"use client"

import { SectionError } from "@/components/feedback/section-error"

/**
 * Failures in one studio tool render inside the project shell, so the sidebar and
 * the user's other tools stay usable. (`app/studio/error.tsx` sits above the
 * project layout and would replace the whole studio.)
 */
export default function StudioToolError(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <SectionError {...props} />
}
