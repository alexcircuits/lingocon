"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { TAB_WRITE_PERMISSION } from "@/lib/studio-nav"

/**
 * What the signed-in user may change in this studio project, from the studio layout.
 * The server enforces every write; this only keeps the UI honest, so read-only
 * visitors (viewers, collaborators without a scope, anyone opening a public
 * project's studio) are not offered buttons that are then refused.
 */
interface StudioAccess {
  /** Owner-only actions: delete, transfer, collaborators, slug. */
  isOwner: boolean
  /** Owner or admin: every content scope. */
  fullAccess: boolean
  permissions: readonly string[]
}

const StudioAccessContext = createContext<StudioAccess>({ isOwner: false, fullAccess: false, permissions: [] })

export function StudioAccessProvider({ value, children }: { value: StudioAccess; children: ReactNode }) {
  const memo = useMemo(() => value, [value.isOwner, value.fullAccess, value.permissions]) // eslint-disable-line react-hooks/exhaustive-deps
  return <StudioAccessContext.Provider value={memo}>{children}</StudioAccessContext.Provider>
}

export function useStudioAccess(): StudioAccess & { canWrite: (permission: string) => boolean } {
  const access = useContext(StudioAccessContext)
  return {
    ...access,
    canWrite: (permission: string) => access.fullAccess || access.permissions.includes(permission),
  }
}

/** Renders `children` only for users with `permission` (usable from server components). */
export function IfCanWrite({ permission, children }: { permission: string; children: ReactNode }) {
  const { canWrite } = useStudioAccess()
  return canWrite(permission) ? <>{children}</> : null
}

/** The write permission the studio section at `pathname` needs, or null when none does. */
export function sectionPermission(pathname: string | null): string | null {
  const segment = pathname?.match(/^\/studio\/lang\/[^/]+\/([^/]+)/)?.[1]
  if (!segment) return null
  if (segment === "settings") return "write:settings"
  return TAB_WRITE_PERMISSION[segment] ?? null
}

/** Whether the current studio section is editable for this user (true where no scope applies). */
export function useSectionWritable(): boolean {
  const pathname = usePathname()
  const { canWrite } = useStudioAccess()
  const permission = sectionPermission(pathname)
  return permission === null || canWrite(permission)
}
