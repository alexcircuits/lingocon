"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { EyeOff, Loader2 } from "lucide-react"
import { forceUnpublishArticle, forceUnpublishText } from "@/app/actions/admin-content"
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

interface UnpublishButtonProps {
    id: string
    type: "article" | "text"
    title: string
}

export function UnpublishButton({ id, type, title }: UnpublishButtonProps) {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const handleUnpublish = async () => {
        setIsLoading(true)
        try {
            if (type === "article") {
                await forceUnpublishArticle(id)
            } else {
                await forceUnpublishText(id)
            }
            router.refresh()
        } catch (error) {
            console.error("Failed to unpublish:", error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    title="Unpublish"
                >
                    <EyeOff className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Unpublish {type}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will unpublish &quot;{title}&quot;. The content will remain in the system
                        but will no longer be publicly visible.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleUnpublish}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isLoading}
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Unpublish
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
