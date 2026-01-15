"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Megaphone, Bell, Plus, Trash2, Loader2, X } from "lucide-react"
import { format } from "date-fns"
import { createPlatformUpdate, deletePlatformUpdate } from "@/app/actions/admin-mutations"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"

type PlatformUpdate = {
    id: string
    title: string
    description: string
    createdAt: Date
    icon?: string | null
    link?: string | null
}

export function PlatformUpdatesManager({
    updates
}: {
    updates: PlatformUpdate[]
}) {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const router = useRouter()

    async function handleSubmit(formData: FormData) {
        setIsSubmitting(true)
        try {
            await createPlatformUpdate({
                title: formData.get("title") as string,
                description: formData.get("description") as string,
                link: formData.get("link") as string || undefined,
            })
            setIsDialogOpen(false)
            router.refresh()
        } catch (error) {
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure you want to delete this update?")) return
        setDeletingId(id)
        try {
            await deletePlatformUpdate(id)
            router.refresh()
        } catch (error) {
            console.error(error)
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        <Megaphone className="h-4 w-4 text-primary" />
                        Recent Platform Updates
                    </CardTitle>
                    <CardDescription>
                        Latest announcements shown to users
                    </CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-2">
                            <Plus className="h-4 w-4" />
                            New Update
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>New Platform Update</DialogTitle>
                            <DialogDescription>
                                Announce a new feature or change to all users.
                            </DialogDescription>
                        </DialogHeader>
                        <form action={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input id="title" name="title" placeholder="e.g., New Feature: Dark Mode" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    placeholder="Briefly describe the update..."
                                    className="h-24"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="link">Link (optional)</Label>
                                <Input id="link" name="link" placeholder="/dashboard/settings" />
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Publish Update
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {updates.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No platform updates yet
                    </p>
                ) : (
                    <div className="space-y-3">
                        {updates.map((update) => (
                            <div
                                key={update.id}
                                className="flex items-start gap-3 p-4 rounded-lg border border-border/50 group relative"
                            >
                                <Bell className="h-4 w-4 text-muted-foreground mt-1" />
                                <div className="flex-1 min-w-0 pr-8">
                                    <p className="font-medium">{update.title}</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {update.description}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {format(new Date(update.createdAt), "MMMM d, yyyy")}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDelete(update.id)}
                                    disabled={deletingId === update.id}
                                >
                                    {deletingId === update.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
