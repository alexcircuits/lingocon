"use client"

import { Users } from "lucide-react"

interface ProfileCoverProps {
    // We can add a cover image prop later if needed
    className?: string
}

export function ProfileCover({ className }: ProfileCoverProps) {
    return (
        <div className="relative h-48 md:h-64 w-full overflow-hidden bg-muted/30 border-b">
            {/* Geometric Pattern Background */}
            <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-primary/5 via-primary/5 to-transparent">
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
                        backgroundSize: '24px 24px'
                    }}
                />
                <div className="absolute right-0 top-0 -translate-y-1/2 translate-x-1/2 opacity-[0.03]">
                    <Users className="h-96 w-96 transform" />
                </div>
            </div>

            {/* Gradient Overlay for text readability at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent opacity-50" />
        </div>
    )
}
