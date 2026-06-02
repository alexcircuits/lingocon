"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  inviteCollaborator,
  updateCollaboratorPermissions,
  removeCollaborator,
  getCollaborators,
  transferLanguageOwnership,
} from "@/app/actions/collaborator"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, UserPlus, Users, X, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import type { LanguageCollaborator } from "@prisma/client"
import { UserSearch, type User as SearchUser } from "@/components/user-search"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FULL_EDITOR_PERMISSIONS, PERMISSION_LABELS, type LanguagePermission } from "@/lib/permissions"

interface Preset {
  id: string
  label: string
  description: string
  permissions: string[] | null // null = custom
}

const ROLE_PRESETS: Preset[] = [
  { id: "viewer", label: "Viewer", description: "Read-only studio access", permissions: [] },
  {
    id: "contributor",
    label: "Contributor",
    description: "Submit article and text drafts for review",
    permissions: ["draft:articles", "draft:texts"],
  },
  {
    id: "lexicographer",
    label: "Lexicographer",
    description: "Edit the dictionary",
    permissions: ["write:dictionary"],
  },
  {
    id: "full-editor",
    label: "Full Editor",
    description: "All write permissions",
    permissions: [...FULL_EDITOR_PERMISSIONS],
  },
  { id: "custom", label: "Custom", description: "Choose specific permissions", permissions: null },
]

function resolvePresetId(permissions: string[]): string {
  if (permissions.length === 0) return "viewer"
  const sorted = [...permissions].sort().join(",")
  for (const preset of ROLE_PRESETS) {
    if (preset.permissions === null) continue
    if ([...preset.permissions].sort().join(",") === sorted) return preset.id
  }
  return "custom"
}

function resolvePresetLabel(permissions: string[]): string {
  return ROLE_PRESETS.find((p) => p.id === resolvePresetId(permissions))?.label ?? "Custom"
}

// ── PermissionMatrix ────────────────────────────────────────────────────────

function PermissionMatrix({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (perm: string) => {
    onChange(
      value.includes(perm) ? value.filter((p) => p !== perm) : [...value, perm]
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {(["draft:articles", "draft:texts", ...FULL_EDITOR_PERMISSIONS] as LanguagePermission[]).map((perm) => (
        <label
          key={perm}
          className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 px-3 py-2 text-sm transition-colors hover:bg-muted/50"
        >
          <Checkbox
            checked={value.includes(perm)}
            onCheckedChange={() => toggle(perm)}
          />
          {PERMISSION_LABELS[perm]}
        </label>
      ))}
    </div>
  )
}

// ── PresetSelect ────────────────────────────────────────────────────────────

function PresetSelect({
  presetId,
  permissions,
  onPresetChange,
  onPermissionsChange,
  disabled,
}: {
  presetId: string
  permissions: string[]
  onPresetChange: (id: string, perms: string[]) => void
  onPermissionsChange: (perms: string[]) => void
  disabled?: boolean
}) {
  const [showMatrix, setShowMatrix] = useState(presetId === "custom")

  const handlePresetChange = (id: string) => {
    const preset = ROLE_PRESETS.find((p) => p.id === id)!
    if (id === "custom") {
      setShowMatrix(true)
      onPresetChange(id, permissions) // keep current perms when switching to custom
    } else {
      setShowMatrix(false)
      onPresetChange(id, preset.permissions as string[])
    }
  }

  return (
    <div className="space-y-3">
      <Select value={presetId} onValueChange={handlePresetChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_PRESETS.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              <div>
                <span className="font-medium">{preset.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{preset.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {presetId === "custom" && (
        <div className="space-y-2 rounded-lg border border-border/50 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground"
            onClick={() => setShowMatrix((v) => !v)}
          >
            Permissions
            {showMatrix ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showMatrix && (
            <PermissionMatrix value={permissions} onChange={onPermissionsChange} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

interface CollaboratorsProps {
  languageId: string
  languageSlug: string
  isOwner: boolean
}

type CollaboratorWithUser = LanguageCollaborator & {
  user: { id: string; name: string | null; image: string | null }
}

function userLabel(user: { name: string | null }): string {
  return user.name?.trim() || "Unnamed user"
}

export function Collaborators({ languageId, languageSlug, isOwner }: CollaboratorsProps) {
  const [isPending, startTransition] = useTransition()
  const [collaborators, setCollaborators] = useState<CollaboratorWithUser[]>([])
  const [loading, setLoading] = useState(true)

  // Invite form state
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null)
  const [invitePresetId, setInvitePresetId] = useState("viewer")
  const [invitePermissions, setInvitePermissions] = useState<string[]>([])

  // Per-row editing state: rowId → { presetId, permissions }
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [rowPresetId, setRowPresetId] = useState("viewer")
  const [rowPermissions, setRowPermissions] = useState<string[]>([])

  useEffect(() => {
    loadCollaborators()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageId])

  const loadCollaborators = async () => {
    setLoading(true)
    const result = await getCollaborators(languageId)
    if (result.success && result.data) {
      setCollaborators(result.data as CollaboratorWithUser[])
    } else {
      toast.error(result.error || "Failed to load collaborators")
    }
    setLoading(false)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) { toast.error("Please select a user to invite"); return }

    startTransition(async () => {
      const result = await inviteCollaborator({ languageId, userId: selectedUser.id, permissions: invitePermissions })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Collaborator invited")
        setSelectedUser(null)
        setInvitePresetId("viewer")
        setInvitePermissions([])
        loadCollaborators()
      }
    })
  }

  const startEditRow = (collab: CollaboratorWithUser) => {
    const presetId = resolvePresetId(collab.permissions)
    setEditingRow(collab.id)
    setRowPresetId(presetId)
    setRowPermissions([...collab.permissions])
  }

  const saveRowPermissions = (collab: CollaboratorWithUser) => {
    startTransition(async () => {
      const result = await updateCollaboratorPermissions({ languageId, userId: collab.userId, permissions: rowPermissions })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Permissions updated")
        setEditingRow(null)
        loadCollaborators()
      }
    })
  }

  const handleRemove = async (userId: string) => {
    if (!confirm("Remove this collaborator?")) return
    startTransition(async () => {
      const result = await removeCollaborator({ languageId, userId })
      if (result.error) toast.error(result.error)
      else { toast.success("Collaborator removed"); loadCollaborators() }
    })
  }

  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collaborators</CardTitle>
          <CardDescription>Only the language owner can manage collaborators</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : collaborators.length === 0 ? (
            <EmptyState icon={Users} title="No collaborators" description="Only the language owner can manage collaborators." />
          ) : (
            <div className="space-y-2">
              {collaborators.map((collab) => (
                <div key={collab.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={collab.user.image || undefined} />
                      <AvatarFallback>{(collab.user.name || "U")[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <p className="font-medium">{userLabel(collab.user)}</p>
                  </div>
                  <Badge variant="secondary">{resolvePresetLabel(collab.permissions)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collaborators</CardTitle>
        <CardDescription>
          Invite others to collaborate. Choose a preset role or configure individual permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite Form */}
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>User</Label>
              {selectedUser ? (
                <div className="flex items-center justify-between rounded-md border bg-muted/50 p-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selectedUser.image || undefined} />
                      <AvatarFallback>{selectedUser.name?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium">{userLabel(selectedUser)}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedUser(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <UserSearch languageId={languageId} onSelect={setSelectedUser} label="Search by display name..." />
              )}
            </div>
            <div className="space-y-2">
              <Label>Role / Permissions</Label>
              <PresetSelect
                presetId={invitePresetId}
                permissions={invitePermissions}
                onPresetChange={(id, perms) => { setInvitePresetId(id); setInvitePermissions(perms) }}
                onPermissionsChange={setInvitePermissions}
                disabled={isPending}
              />
            </div>
          </div>
          <Button type="submit" disabled={isPending || !selectedUser}>
            <UserPlus className="mr-2 h-4 w-4" />
            {isPending ? "Inviting..." : "Invite Collaborator"}
          </Button>
        </form>

        {/* Collaborators List */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading collaborators...</p>
        ) : collaborators.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No collaborators yet"
            description="Invite others to collaborate. Use presets or configure custom permissions."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden rounded-lg border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collaborators.map((collab) => (
                    <TableRow key={collab.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={collab.user.image || undefined} />
                            <AvatarFallback>{(collab.user.name || "U")[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <p className="font-medium">{userLabel(collab.user)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingRow === collab.id ? (
                          <div className="space-y-2">
                            <PresetSelect
                              presetId={rowPresetId}
                              permissions={rowPermissions}
                              onPresetChange={(id, perms) => { setRowPresetId(id); setRowPermissions(perms) }}
                              onPermissionsChange={setRowPermissions}
                              disabled={isPending}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveRowPermissions(collab)} disabled={isPending}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingRow(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="cursor-pointer"
                            onClick={() => startEditRow(collab)}
                            title="Click to edit permissions"
                          >
                            <Badge variant="secondary">{resolvePresetLabel(collab.permissions)}</Badge>
                          </button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove collaborator"
                          onClick={() => handleRemove(collab.userId)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {collaborators.map((collab) => (
                <div key={collab.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={collab.user.image || undefined} />
                      <AvatarFallback>{(collab.user.name || "U")[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{userLabel(collab.user)}</p>
                      <Badge variant="secondary" className="mt-1">{resolvePresetLabel(collab.permissions)}</Badge>
                    </div>
                  </div>
                  {editingRow === collab.id ? (
                    <div className="space-y-2">
                      <PresetSelect
                        presetId={rowPresetId}
                        permissions={rowPermissions}
                        onPresetChange={(id, perms) => { setRowPresetId(id); setRowPermissions(perms) }}
                        onPermissionsChange={setRowPermissions}
                        disabled={isPending}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => saveRowPermissions(collab)} disabled={isPending}>Save</Button>
                        <Button size="sm" variant="ghost" className="flex-1" onClick={() => setEditingRow(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" size="sm" onClick={() => startEditRow(collab)}>Edit Permissions</Button>
                      <Button variant="outline" size="sm" onClick={() => handleRemove(collab.userId)} disabled={isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Transfer Ownership ──────────────────────────────────────────────────────

export function TransferOwnershipCard({ languageId, languageSlug }: { languageId: string; languageSlug: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [transferUser, setTransferUser] = useState<SearchUser | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const handleTransfer = () => {
    if (!transferUser) return
    if (!confirmed) { setConfirmed(true); return }
    startTransition(async () => {
      const result = await transferLanguageOwnership({ languageId, newOwnerId: transferUser.id })
      if (result.error) {
        toast.error(result.error)
        setConfirmed(false)
      } else {
        toast.success(`Ownership transferred to ${transferUser.name ?? "new owner"}`)
        router.push(`/lang/${languageSlug}`)
      }
    })
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Transfer Ownership
        </CardTitle>
        <CardDescription>
          Transfer this language to another user. You will become an Editor. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {transferUser ? (
          <div className="flex items-center justify-between rounded-md border bg-muted/50 p-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={transferUser.image || undefined} />
                <AvatarFallback>{transferUser.name?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
              </Avatar>
              <p className="text-sm font-medium">{userLabel(transferUser)}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setTransferUser(null); setConfirmed(false) }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <UserSearch languageId={languageId} onSelect={setTransferUser} label="Search for new owner..." />
        )}
        {confirmed && transferUser && (
          <p className="text-sm font-medium text-destructive">
            Are you sure? <strong>{userLabel(transferUser)}</strong> will become the owner and you will lose owner access.
          </p>
        )}
        <Button variant="destructive" disabled={!transferUser || isPending} onClick={handleTransfer}>
          {isPending ? "Transferring..." : confirmed ? "Confirm Transfer" : "Transfer Ownership"}
        </Button>
      </CardContent>
    </Card>
  )
}
