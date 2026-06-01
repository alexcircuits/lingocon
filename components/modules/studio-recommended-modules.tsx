"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { ModuleIcon } from "@/components/modules/module-icon"
import { addModule } from "@/app/actions/module"
import { getModuleTypeMeta } from "@/lib/modules/types"
import { formatSurfaces } from "@/lib/modules/surfaces"
import type { ModulePermission } from "@/lib/modules/types"
import type { ModuleType } from "@prisma/client"

export type RecommendedModule = {
  id: string
  slug: string
  name: string
  icon: string | null
  type: ModuleType
  summary: string | null
  permissions: string[]
}

export function StudioRecommendedModules({
  languageId,
  languageName,
  modules,
}: {
  languageId: string
  languageName: string
  modules: RecommendedModule[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (modules.length === 0) return null

  function addOne(mod: RecommendedModule) {
    startTransition(async () => {
      const res = await addModule({
        moduleId: mod.id,
        languageId,
        grantedPermissions: mod.permissions as ModulePermission[],
      })
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success(`${mod.name} added to ${languageName}`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">Try official modules</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {modules.map((m) => {
          const typeMeta = getModuleTypeMeta(m.type)
          return (
            <Card key={m.id}>
              <CardContent className="flex items-start gap-3 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ModuleIcon name={m.icon ?? typeMeta.icon} className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {m.summary ?? typeMeta.description}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{formatSurfaces(m.type)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={pending}
                  onClick={() => addOne(m)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
