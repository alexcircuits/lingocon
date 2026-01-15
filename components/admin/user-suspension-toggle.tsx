"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Ban, Check, Loader2 } from "lucide-react"
import { toggleUserSuspension } from "@/app/actions/admin-users"
import { useRouter } from "next/navigation"
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

interface UserSuspensionToggleProps {
    userId: string
    isSuspended: boolean
    suspendReason?: string | null
}

export function UserSuspensionToggle({
    userId,
    isSuspended,
    suspendReason
}: UserSuspensionToggleProps) {
    const [suspended, setSuspended] = useState(isSuspended)
    const [reason, setReason] = useState(suspendReason || "")
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const handleToggle = async () => {
        setIsLoading(true)
        try {
            await toggleUserSuspension(userId, !suspended, reason)
            setSuspended(!suspended)
            router.refresh()
        } catch (error) {
            console.error("Failed to toggle suspension:", error)
        } finally {
            setIsLoading(false)
        }
    }

    if (suspended) {
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-destructive">
                    <Ban className="h-4 w-4" />
                    <span className="font-medium">User is suspended</span>
                </div>
                {suspendReason && (
                    <p className="text-sm text-muted-foreground">
                        Reason: {suspendReason}
                    </p>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggle}
                    disabled={isLoading}
                    className="gap-2"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Check className="h-4 w-4" />
                    )}
                    Unsuspend User
                </Button>
            </div>
        )
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                    <Ban className="h-4 w-4" />
                    Suspend User
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Suspend this user?</AlertDialogTitle>
                    <AlertDialogDescription>
                        The user will be blocked from accessing the platform.
                        You can unsuspend them at any time.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                    <Label htmlFor="reason">Reason (optional)</Label>
                    <Textarea
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Enter reason for suspension..."
                        className="mt-2"
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleToggle}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isLoading}
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Suspend User
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
