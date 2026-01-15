"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Save, Loader2 } from "lucide-react"
import { updateAdminNotes } from "@/app/actions/admin-users"
import { useRouter } from "next/navigation"

interface AdminNotesEditorProps {
    userId: string
    notes?: string | null
}

export function AdminNotesEditor({ userId, notes }: AdminNotesEditorProps) {
    const [value, setValue] = useState(notes || "")
    const [isLoading, setIsLoading] = useState(false)
    const [saved, setSaved] = useState(false)
    const router = useRouter()

    const handleSave = async () => {
        setIsLoading(true)
        try {
            await updateAdminNotes(userId, value)
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
            router.refresh()
        } catch (error) {
            console.error("Failed to save notes:", error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-3">
            <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Add internal notes about this user..."
                className="min-h-[100px]"
            />
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSave}
                    disabled={isLoading || value === (notes || "")}
                    className="gap-2"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    Save Notes
                </Button>
                {saved && (
                    <span className="text-sm text-green-600">Saved!</span>
                )}
            </div>
        </div>
    )
}
