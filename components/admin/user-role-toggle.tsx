"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toggleUserAdmin } from "@/app/actions/admin-mutations"
import { Loader2, Shield, ShieldAlert } from "lucide-react"
import { useRouter } from "next/navigation"

export function UserRoleToggle({
    userId,
    isAdmin
}: {
    userId: string
    isAdmin: boolean
}) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleToggle = async () => {
        const action = isAdmin ? "remove admin privileges from" : "grant admin privileges to"
        if (!confirm(`Are you sure you want to ${action} this user?`)) return

        setLoading(true)
        try {
            await toggleUserAdmin(userId, !isAdmin)
            router.refresh()
        } catch (error) {
            console.error(error)
            alert("Failed to update user role")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            variant={isAdmin ? "destructive" : "default"}
            size="sm"
            onClick={handleToggle}
            disabled={loading}
            className="gap-2"
        >
            {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : isAdmin ? (
                <ShieldAlert className="h-4 w-4" />
            ) : (
                <Shield className="h-4 w-4" />
            )}
            {isAdmin ? "Remove Admin" : "Make Admin"}
        </Button>
    )
}
