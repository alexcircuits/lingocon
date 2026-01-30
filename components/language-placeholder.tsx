"use client"

import { cn } from "@/lib/utils"
import Image from "next/image"

interface LanguagePlaceholderProps {
    name: string
    flagUrl?: string | null
    className?: string
    // Variant styles for different contexts
    variant?: "flag" | "square" | "circle"
    // Size presets
    size?: "xs" | "sm" | "md" | "lg"
}

// Generate a consistent color based on the language name
function getGradientFromName(name: string): [string, string] {
    // Simple hash function
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        const char = name.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }

    // Use hash to select from curated gradient pairs
    const gradients: [string, string][] = [
        ["#667eea", "#764ba2"], // Purple blue
        ["#f093fb", "#f5576c"], // Pink red
        ["#4facfe", "#00f2fe"], // Blue cyan
        ["#43e97b", "#38f9d7"], // Green teal
        ["#fa709a", "#fee140"], // Pink yellow
        ["#a8edea", "#fed6e3"], // Teal pink
        ["#ff9a9e", "#fad0c4"], // Coral peach
        ["#ffecd2", "#fcb69f"], // Cream orange
        ["#a18cd1", "#fbc2eb"], // Lavender pink
        ["#fad0c4", "#ffd1ff"], // Peach pink
        ["#667eea", "#f093fb"], // Purple pink
        ["#00c6fb", "#005bea"], // Cyan blue
        ["#d299c2", "#fef9d7"], // Mauve cream
        ["#89f7fe", "#66a6ff"], // Cyan blue
        ["#cd9cf2", "#f6f3ff"], // Lilac white
        ["#fddb92", "#d1fdff"], // Yellow mint
    ]

    const index = Math.abs(hash) % gradients.length
    return gradients[index]
}

// Get initials from language name (1-2 characters)
function getInitials(name: string): string {
    const words = name.trim().split(/\s+/)
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
}

const sizeStyles = {
    xs: "h-5 w-7 text-[8px]",
    sm: "h-7 w-10 text-xs",
    md: "h-10 w-14 text-sm",
    lg: "h-16 w-24 text-base",
}

const variantStyles = {
    flag: "rounded-sm",
    square: "rounded-md",
    circle: "rounded-full aspect-square !w-auto",
}

export function LanguagePlaceholder({
    name,
    flagUrl,
    className,
    variant = "flag",
    size = "sm",
}: LanguagePlaceholderProps) {
    const [color1, color2] = getGradientFromName(name)
    const initials = getInitials(name)

    // If there's a flag URL, show the image
    if (flagUrl) {
        return (
            <div
                className={cn(
                    "relative overflow-hidden border border-border/20 shadow-sm shrink-0",
                    sizeStyles[size],
                    variantStyles[variant],
                    className
                )}
            >
                <Image
                    src={flagUrl}
                    alt={name}
                    fill
                    className="object-cover"
                    unoptimized={flagUrl.startsWith("/uploads/")}
                />
            </div>
        )
    }

    // Otherwise, show a nice gradient with initials
    return (
        <div
            className={cn(
                "relative flex items-center justify-center overflow-hidden border border-white/20 shadow-sm shrink-0 font-medium text-white/90 select-none",
                sizeStyles[size],
                variantStyles[variant],
                className
            )}
            style={{
                background: `linear-gradient(135deg, ${color1}, ${color2})`,
            }}
        >
            {initials}
        </div>
    )
}
