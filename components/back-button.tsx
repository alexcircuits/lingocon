"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export function BackButton() {
    const router = useRouter()

    return (
        <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground absolute left-4 top-4 z-50"
            onClick={() => router.back()}
        >
            <ArrowLeft className="h-4 w-4" />
            Back
        </Button>
    )
}
