"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  Globe,
  Lock,
  Eye,
  Languages,
  ArrowRight,
  GripVertical,
  Shield,
} from "lucide-react"
import { createFamily, updateFamily, deleteFamily, setLanguageFamily } from "@/app/actions/language-family"

interface FamilyLanguage {
  id: string
  name: string
  slug: string
  flagUrl: string | null
  _count: { dictionaryEntries: number }
}

interface Family {
  id: string
  name: string
  slug: string
  description: string | null
  visibility: string
  type: string
  createdAt: Date
  languages: FamilyLanguage[]
  _count: { languages: number }
}

interface FamilyManagerProps {
  families: Family[]
  unassignedLanguages: FamilyLanguage[]
}

export function FamilyManager({ families, unassignedLanguages }: FamilyManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newVisibility, setNewVisibility] = useState<string>("PRIVATE")

  // Edit dialog
  const [editFamily, setEditFamily] = useState<Family | null>(null)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editVisibility, setEditVisibility] = useState<string>("PRIVATE")

  // Assign dialog
  const [assignFamily, setAssignFamily] = useState<Family | null>(null)

  const handleCreate = () => {
    if (!newName.trim()) return
    startTransition(async () => {
      const result = await createFamily({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        visibility: newVisibility as "PRIVATE" | "UNLISTED" | "PUBLIC",
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Family "${newName}" created!`)
        setCreateOpen(false)
        setNewName("")
        setNewDesc("")
        setNewVisibility("PRIVATE")
        router.refresh()
      }
    })
  }

  const handleUpdate = () => {
    if (!editFamily || !editName.trim()) return
    startTransition(async () => {
      const result = await updateFamily(editFamily.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        visibility: editVisibility as "PRIVATE" | "UNLISTED" | "PUBLIC",
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Family updated!")
        setEditFamily(null)
        router.refresh()
      }
    })
  }

  const handleDelete = (familyId: string) => {
    startTransition(async () => {
      const result = await deleteFamily(familyId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Family deleted.")
        router.refresh()
      }
    })
  }

  const handleAssignLanguage = (languageId: string, familyId: string) => {
    startTransition(async () => {
      const result = await setLanguageFamily(languageId, familyId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Language assigned to family!")
        router.refresh()
      }
    })
  }

  const handleRemoveFromFamily = (languageId: string) => {
    startTransition(async () => {
      const result = await setLanguageFamily(languageId, null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Language removed from family.")
        router.refresh()
      }
    })
  }

  const openEdit = (family: Family) => {
    setEditFamily(family)
    setEditName(family.name)
    setEditDesc(family.description || "")
    setEditVisibility(family.visibility)
  }

  const visibilityIcon = (v: string) => {
    if (v === "PUBLIC") return <Globe className="h-3.5 w-3.5" />
    if (v === "UNLISTED") return <Eye className="h-3.5 w-3.5" />
    return <Lock className="h-3.5 w-3.5" />
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif tracking-tight mb-1 flex items-center gap-3">
            <FolderTree className="h-8 w-8 text-primary" />
            Manage Families
          </h1>
          <p className="text-muted-foreground">
            Create, rename, and organize your language families.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Family
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Language Family</DialogTitle>
              <DialogDescription>
                Group related languages under a named family.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Elvish Languages"
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="A brief description..."
                />
              </div>
              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select value={newVisibility} onValueChange={setNewVisibility}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIVATE">Private</SelectItem>
                    <SelectItem value="UNLISTED">Unlisted</SelectItem>
                    <SelectItem value="PUBLIC">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={isPending || !newName.trim()}>
                Create Family
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Unassigned Languages */}
      {unassignedLanguages.length > 0 && (
        <Card className="p-5">
          <h3 className="font-medium mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Languages className="h-4 w-4" />
            {unassignedLanguages.length} Unassigned Language{unassignedLanguages.length !== 1 ? "s" : ""}
          </h3>
          <div className="flex flex-wrap gap-2">
            {unassignedLanguages.map(lang => (
              <Badge key={lang.id} variant="secondary" className="gap-1.5 py-1 px-2.5 text-sm">
                {lang.flagUrl && (
                  <img src={lang.flagUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                )}
                {lang.name}
                <span className="text-xs text-muted-foreground">({lang._count.dictionaryEntries})</span>
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Family Cards */}
      {families.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderTree className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-2">No families yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first language family to start organizing your languages.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Family
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {families.map(family => (
            <Card key={family.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-serif text-lg font-medium">{family.name}</h3>
                    {family.type === "SYSTEM" && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Shield className="h-3 w-3" />
                        System
                      </Badge>
                    )}
                    <Badge variant="secondary" className="gap-1 text-xs">
                      {visibilityIcon(family.visibility)}
                      {family.visibility.toLowerCase()}
                    </Badge>
                  </div>
                  {family.description && (
                    <p className="text-sm text-muted-foreground">{family.description}</p>
                  )}
                </div>

                <div className="flex gap-1">
                  {family.type !== "SYSTEM" && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(family)} disabled={isPending}>
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={isPending}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete &ldquo;{family.name}&rdquo;?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Languages in this family will become unassigned. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(family.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>

              {/* Languages in family */}
              <div className="space-y-1.5">
                {family.languages.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">No languages in this family yet.</p>
                ) : (
                  family.languages.map(lang => (
                    <div key={lang.id} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-secondary/30 hover:bg-secondary/50 transition-colors group">
                      <div className="flex items-center gap-2">
                        {lang.flagUrl ? (
                          <img src={lang.flagUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                        ) : (
                          <Globe className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">{lang.name}</span>
                        <span className="text-xs text-muted-foreground">{lang._count.dictionaryEntries} words</span>
                      </div>
                      {family.type !== "SYSTEM" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFromFamily(lang.id)}
                          disabled={isPending}
                          className="opacity-0 group-hover:opacity-100 h-7 text-xs text-muted-foreground hover:text-destructive"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add language button */}
              {unassignedLanguages.length > 0 && (
                <Dialog open={assignFamily?.id === family.id} onOpenChange={(open) => !open && setAssignFamily(null)}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-1.5 text-xs"
                      onClick={() => setAssignFamily(family)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Language
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add language to {family.name}</DialogTitle>
                      <DialogDescription>
                        Choose a language to assign to this family.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5 py-2 max-h-[300px] overflow-y-auto">
                      {unassignedLanguages.map(lang => (
                        <button
                          key={lang.id}
                          onClick={() => {
                            handleAssignLanguage(lang.id, family.id)
                            setAssignFamily(null)
                          }}
                          disabled={isPending}
                          className="w-full flex items-center justify-between py-2 px-3 rounded-md hover:bg-secondary/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            {lang.flagUrl ? (
                              <img src={lang.flagUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                            ) : (
                              <Globe className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm">{lang.name}</span>
                            <span className="text-xs text-muted-foreground">({lang._count.dictionaryEntries} words)</span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editFamily} onOpenChange={(open) => !open && setEditFamily(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Family</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleUpdate()}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={editVisibility} onValueChange={setEditVisibility}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE">Private</SelectItem>
                  <SelectItem value="UNLISTED">Unlisted</SelectItem>
                  <SelectItem value="PUBLIC">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdate} disabled={isPending || !editName.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
