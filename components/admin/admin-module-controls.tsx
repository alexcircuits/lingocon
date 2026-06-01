"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { adminSetModuleStatus, adminYankVersion, adminResolveReport } from "@/app/actions/module"

const STATUSES = ["DRAFT", "IN_REVIEW", "PUBLISHED", "SUSPENDED", "DEPRECATED"]

export function AdminModuleStatusControl({
  moduleId,
  status,
}: {
  moduleId: string
  status: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function setStatus(next: string) {
    startTransition(async () => {
      const res = await adminSetModuleStatus(moduleId, next)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success(`Status set to ${next}`)
      router.refresh()
    })
  }

  return (
    <Select value={status} onValueChange={setStatus} disabled={pending}>
      <SelectTrigger className="h-8 w-[150px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function AdminYankControl({
  versionId,
  yanked,
}: {
  versionId: string
  yanked: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      const res = await adminYankVersion(versionId, !yanked)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success(yanked ? "Version restored" : "Version yanked")
      router.refresh()
    })
  }

  return (
    <Button variant={yanked ? "outline" : "destructive"} size="sm" onClick={toggle} disabled={pending}>
      {yanked ? "Un-yank latest" : "Yank latest"}
    </Button>
  )
}

export function AdminReportControls({ reportId }: { reportId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function resolve(status: string) {
    startTransition(async () => {
      const res = await adminResolveReport(reportId, status)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success(`Report ${status.toLowerCase()}`)
      router.refresh()
    })
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => resolve("RESOLVED")} disabled={pending}>
        Resolve
      </Button>
      <Button variant="ghost" size="sm" onClick={() => resolve("DISMISSED")} disabled={pending}>
        Dismiss
      </Button>
    </div>
  )
}
