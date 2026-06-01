"use client"

import Link from "next/link"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2 } from "lucide-react"
import { ModuleIcon } from "@/components/modules/module-icon"
import { removeModule } from "@/app/actions/module"
import { getModuleTypeMeta, PERMISSION_LABELS, type ModulePermission } from "@/lib/modules/types"
import type { ModuleType } from "@prisma/client"

export interface AccountInstall {
  installId: string
  moduleSlug: string
  name: string
  icon: string | null
  type: ModuleType
  version: string
  grantedPermissions: string[]
}

export function AccountModulesList({ installs }: { installs: AccountInstall[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function remove(installId: string) {
    startTransition(async () => {
      const res = await removeModule(installId)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Removed")
      router.refresh()
    })
  }

  if (installs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            You haven&apos;t added any modules account-wide.
          </p>
          <Link href="/modules">
            <Button variant="outline">Browse modules</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {installs.map((i) => {
        const typeMeta = getModuleTypeMeta(i.type)
        return (
          <Card key={i.installId}>
            <CardContent className="flex items-start gap-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ModuleIcon name={i.icon ?? typeMeta.icon} className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/modules/${i.moduleSlug}`} className="font-medium hover:text-primary">
                  {i.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {typeMeta.label} · v{i.version}
                </p>
                {i.grantedPermissions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {i.grantedPermissions.map((p) => (
                      <Badge key={p} variant="outline" className="text-[10px]">
                        {PERMISSION_LABELS[p as ModulePermission] ?? p}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(i.installId)} disabled={pending}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
