"use client"

import Link from "next/link"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Globe, ExternalLink, PanelsTopLeft } from "lucide-react"
import { ModuleIcon } from "@/components/modules/module-icon"
import { removeModule } from "@/app/actions/module"
import { getModuleTypeMeta } from "@/lib/modules/types"
import { surfacesForType, SURFACE_LABELS } from "@/lib/modules/surfaces"
import type { ModuleType } from "@prisma/client"

export interface ManagerInstall {
  installId: string
  moduleSlug: string
  name: string
  icon: string | null
  type: ModuleType
  version: string
  accountWide: boolean
  languageSlug: string
}

export function LanguageModulesManager({
  installs,
  languageSlug,
}: {
  installs: ManagerInstall[]
  languageSlug: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function remove(installId: string) {
    startTransition(async () => {
      const res = await removeModule(installId)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Module removed")
      router.refresh()
    })
  }

  if (installs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">No modules added yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add reader widgets, charts, sound-change packs, or themes below — then open them from
              the sidebar or see them on your public page.
            </p>
          </div>
          <Link href="/modules">
            <Button>Browse catalog</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {installs.map((i) => {
        const typeMeta = getModuleTypeMeta(i.type)
        const surfaces = surfacesForType(i.type)
        const panelHref = `/studio/lang/${languageSlug}/modules/${i.moduleSlug}`

        return (
          <Card key={i.installId}>
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ModuleIcon name={i.icon ?? typeMeta.icon} className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/modules/${i.moduleSlug}`}
                      className="truncate font-medium hover:text-primary"
                    >
                      {i.name}
                    </Link>
                    {i.accountWide && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Globe className="h-3 w-3" /> All languages
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {typeMeta.label} · v{i.version}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {surfaces.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px] font-normal">
                        {SURFACE_LABELS[s].short}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link href={panelHref}>
                  <Button variant="default" size="sm" className="gap-1.5">
                    <PanelsTopLeft className="h-3.5 w-3.5" />
                    Open
                  </Button>
                </Link>
                <Link href={`/lang/${languageSlug}`} target="_blank">
                  <Button variant="ghost" size="sm" title="View public page">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(i.installId)}
                  disabled={pending || i.accountWide}
                  title={i.accountWide ? "Remove from Settings → Modules" : "Remove from this language"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
