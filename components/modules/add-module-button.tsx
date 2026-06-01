"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Check, ShieldCheck } from "lucide-react"
import { addModule, removeModule } from "@/app/actions/module"
import { PERMISSION_LABELS, type ModulePermission } from "@/lib/modules/types"

interface AddModuleButtonProps {
  moduleId: string
  permissions: string[]
  isAuthenticated: boolean
  /** Existing install id for removal (account-wide or language-scoped). */
  installId?: string | null
  /** When set, adds scoped to this language (studio flow). */
  languageId?: string
  languageName?: string
  size?: "default" | "sm"
}

export function AddModuleButton({
  moduleId,
  permissions,
  isAuthenticated,
  installId,
  languageId,
  languageName,
  size = "default",
}: AddModuleButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const added = Boolean(installId)
  const scoped = Boolean(languageId)

  function confirmAdd() {
    startTransition(async () => {
      const res = await addModule({
        moduleId,
        languageId: languageId ?? null,
        grantedPermissions: permissions as ModulePermission[],
      })
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success(
        scoped
          ? `Added to ${languageName ?? "this language"}`
          : "Added to all your languages"
      )
      setOpen(false)
      router.refresh()
    })
  }

  function remove() {
    if (!installId) return
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

  if (!isAuthenticated) {
    return (
      <Button asChild size={size}>
        <a href="/login">
          <Plus className="mr-2 h-4 w-4" />
          Sign in to add
        </a>
      </Button>
    )
  }

  if (added) {
    return (
      <Button variant="outline" size={size} onClick={remove} disabled={pending}>
        <Check className="mr-2 h-4 w-4 text-primary" />
        Added — remove
      </Button>
    )
  }

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)} disabled={pending}>
        <Plus className="mr-2 h-4 w-4" />
        {scoped ? "Add to language" : "Add module"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add this module</DialogTitle>
            <DialogDescription>
              {scoped ? (
                <>
                  It will be enabled for <strong>{languageName}</strong> only. Reader widgets and
                  themes you add here also appear on that language&apos;s public page for all
                  visitors.
                </>
              ) : (
                <>
                  It will be available across all of your languages. To scope to one language
                  instead, add it from that language&apos;s studio → Modules.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {permissions.length > 0 ? (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                This module will be able to:
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {permissions.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                    {PERMISSION_LABELS[p as ModulePermission] ?? p}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This module requests no special permissions.
            </p>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={confirmAdd} disabled={pending}>
              {pending ? "Adding…" : scoped ? "Add to this language" : "Add to my languages"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
