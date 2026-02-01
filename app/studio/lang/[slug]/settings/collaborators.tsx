"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  inviteCollaborator,
  updateCollaboratorRole,
  removeCollaborator,
  getCollaborators,
} from "@/app/actions/collaborator"
import { Button } from "@/components/ui/button"

import { Label } from "@/components/ui/label"
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
import { Trash2, UserPlus, Users, X } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import type { LanguageCollaborator, CollaboratorRole } from "@prisma/client"
import { UserSearch, type User as SearchUser } from "@/components/user-search"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface CollaboratorsProps {
  languageId: string
  isOwner: boolean
}

export function Collaborators({ languageId, isOwner }: CollaboratorsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [collaborators, setCollaborators] = useState<
    Array<
      LanguageCollaborator & {
        user: {
          id: string
          name: string | null
          email: string | null
          image: string | null
        }
      }
    >
  >([])
  const [loading, setLoading] = useState(true)
  // Removed duplicate loading
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null)
  const [role, setRole] = useState<CollaboratorRole>("VIEWER")

  useEffect(() => {
    loadCollaborators()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageId])

  const loadCollaborators = async () => {
    setLoading(true)
    const result = await getCollaborators(languageId)
    if (result.success && result.data) {
      setCollaborators(result.data)
    } else {
      toast.error(result.error || "Failed to load collaborators")
    }
    setLoading(false)
  }

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isOwner) {
      toast.error("Only the language owner can invite collaborators")
      return
    }

    if (!selectedUser) {
      toast.error("Please select a user to invite")
      return
    }

    startTransition(async () => {
      const result = await inviteCollaborator({
        languageId,
        userId: selectedUser.id,
        role,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Collaborator invited successfully")
        setSelectedUser(null)
        setRole("VIEWER")
        loadCollaborators()
      }
    })
  }

  const handleUpdateRole = async (userId: string, newRole: CollaboratorRole) => {
    if (!isOwner) {
      toast.error("Only the language owner can update roles")
      return
    }

    startTransition(async () => {
      const result = await updateCollaboratorRole({
        languageId,
        userId,
        role: newRole,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Role updated successfully")
        loadCollaborators()
      }
    })
  }

  const handleRemove = async (userId: string) => {
    if (!isOwner) {
      toast.error("Only the language owner can remove collaborators")
      return
    }

    if (!confirm("Are you sure you want to remove this collaborator?")) {
      return
    }

    startTransition(async () => {
      const result = await removeCollaborator({
        languageId,
        userId,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Collaborator removed successfully")
        loadCollaborators()
      }
    })
  }

  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collaborators</CardTitle>
          <CardDescription>
            Only the language owner can manage collaborators
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : collaborators.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No collaborators"
              description="Only the language owner can manage collaborators."
            />
          ) : (
            <div className="space-y-2">
              {collaborators.map((collab) => (
                <div
                  key={collab.id}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <div>
                    <p className="font-medium">
                      {collab.user.name || collab.user.email || "Anonymous"}
                    </p>
                    <p className="text-xs text-muted-foreground">{collab.role}</p>
                  </div>
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
          Invite others to collaborate on this language. Editors can make changes, viewers can only view.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite Form */}
        <form onSubmit={handleInvite} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>User</Label>
              {selectedUser ? (
                <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selectedUser.image || undefined} />
                      <AvatarFallback>{selectedUser.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{selectedUser.name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">{selectedUser.email}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSelectedUser(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <UserSearch
                  onSelect={setSelectedUser}
                  label="Search by name or email..."
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="collaborator-role">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as CollaboratorRole)}>
                <SelectTrigger id="collaborator-role" disabled={isPending}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDITOR">Editor</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
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
            description="Invite others to collaborate on this language. Editors can make changes, viewers can only view."
          />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collaborators.map((collab) => (
                  <TableRow key={collab.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {collab.user.name || collab.user.email || "Anonymous"}
                        </p>
                        {collab.user.email && (
                          <p className="text-xs text-muted-foreground">{collab.user.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={collab.role}
                        onValueChange={(value) =>
                          handleUpdateRole(collab.userId, value as CollaboratorRole)
                        }
                        disabled={isPending || !isOwner}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EDITOR">Editor</SelectItem>
                          <SelectItem value="VIEWER">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(collab.userId)}
                        disabled={isPending || !isOwner}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

