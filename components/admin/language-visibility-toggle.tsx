"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Globe, Eye, EyeOff, Loader2, ChevronDown } from "lucide-react"
import { forceLanguageVisibility } from "@/app/actions/admin-content"
import { useRouter } from "next/navigation"

type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE"

const visibilityConfig = {
    PUBLIC: { icon: Globe, label: "Public", color: "text-green-600" },
    UNLISTED: { icon: EyeOff, label: "Unlisted", color: "text-yellow-600" },
    PRIVATE: { icon: Eye, label: "Private", color: "text-gray-600" }
}

interface LanguageVisibilityToggleProps {
    languageId: string
    currentVisibility: Visibility
}

export function LanguageVisibilityToggle({
    languageId,
    currentVisibility
}: LanguageVisibilityToggleProps) {
    const [visibility, setVisibility] = useState<Visibility>(currentVisibility)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const CurrentIcon = visibilityConfig[visibility].icon

    const handleChange = async (newVisibility: Visibility) => {
        if (newVisibility === visibility) return

        setIsLoading(true)
        try {
            await forceLanguageVisibility(languageId, newVisibility)
            setVisibility(newVisibility)
            router.refresh()
        } catch (error) {
            console.error("Failed to change visibility:", error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isLoading} className="gap-2">
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <CurrentIcon className={`h-4 w-4 ${visibilityConfig[visibility].color}`} />
                    )}
                    {visibilityConfig[visibility].label}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {(Object.keys(visibilityConfig) as Visibility[]).map((vis) => {
                    const config = visibilityConfig[vis]
                    const Icon = config.icon
                    return (
                        <DropdownMenuItem
                            key={vis}
                            onClick={() => handleChange(vis)}
                            className="gap-2"
                        >
                            <Icon className={`h-4 w-4 ${config.color}`} />
                            {config.label}
                        </DropdownMenuItem>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
