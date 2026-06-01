"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

const ALL = "__all__"

function humanize(value: string) {
    return value
        .toLowerCase()
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
}

export function AuditFilters({
    actions,
    resources
}: {
    actions: string[]
    resources: string[]
}) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const currentAction = searchParams.get("action") ?? ALL
    const currentResource = searchParams.get("resource") ?? ALL
    const hasFilters = currentAction !== ALL || currentResource !== ALL

    const setParam = useCallback(
        (key: string, value: string) => {
            const params = new URLSearchParams(searchParams.toString())
            if (value === ALL) {
                params.delete(key)
            } else {
                params.set(key, value)
            }
            // Reset pagination whenever filters change
            params.delete("page")
            router.push(`/admin/audit?${params.toString()}`)
        },
        [router, searchParams]
    )

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Select value={currentResource} onValueChange={(v) => setParam("resource", v)}>
                <SelectTrigger className="h-9 w-[160px]">
                    <SelectValue placeholder="Resource" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>All resources</SelectItem>
                    {resources.map((r) => (
                        <SelectItem key={r} value={r}>
                            {humanize(r)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={currentAction} onValueChange={(v) => setParam("action", v)}>
                <SelectTrigger className="h-9 w-[180px]">
                    <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>All actions</SelectItem>
                    {actions.map((a) => (
                        <SelectItem key={a} value={a}>
                            {humanize(a)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {hasFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/admin/audit")}
                    className="h-9 gap-1.5 text-muted-foreground"
                >
                    <X className="h-3.5 w-3.5" />
                    Clear
                </Button>
            )}
        </div>
    )
}
