"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { FileQuestion, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { findRenamedStudioPath } from "@/app/actions/language"

/**
 * A missing grammar page, article, text, course or module inside an existing
 * project renders within the studio shell with a way back, instead of the
 * full-screen site 404 that hides the project's navigation.
 *
 * It is also where an old slug lands after a rename when the project layout (and
 * its redirect) does not run: links in a tab opened before the rename, and in-app
 * navigations between sections. So it first asks whether this path belongs to a
 * renamed project and, if so, continues to the same section there.
 */
export default function StudioToolNotFound() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations("errors")
  const tCommon = useTranslations("common")
  const [checking, setChecking] = useState(true)
  const projectPath = pathname?.match(/^\/studio\/lang\/[^/]+/)?.[0] ?? "/dashboard"

  useEffect(() => {
    let active = true
    setChecking(true)
    findRenamedStudioPath(pathname ?? "")
      .then((renamedPath) => {
        if (!active) return
        if (renamedPath) router.replace(renamedPath)
        else setChecking(false)
      })
      .catch(() => {
        if (active) setChecking(false)
      })
    return () => {
      active = false
    }
  }, [pathname, router])

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{tCommon("loading")}</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <FileQuestion className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold">{t("pageNotFound")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("studioPageNotFound")}</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href={projectPath}>{t("backToProject")}</Link>
        </Button>
      </div>
    </div>
  )
}
