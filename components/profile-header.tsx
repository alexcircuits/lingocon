"use client"

import { formatDate } from "@/lib/utils"
import { Calendar, Users } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { FollowButton } from "@/components/follow-button"
import { BadgeShowcase } from "@/components/badges"
import { BadgeData } from "@/components/badges/badge-card"

interface ProfileHeaderProps {
    user: {
        id: string
        name: string | null
        image: string | null
        createdAt: Date
    }
    isOwnProfile: boolean
    badges?: BadgeData[]
}

export function ProfileHeader({ user, isOwnProfile, badges = [] }: ProfileHeaderProps) {
    return (
        <div className="relative border-b bg-card pb-12 pt-24 md:pt-32">
            {/* Geometric Pattern Background */}
            <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-primary/5 via-primary/5 to-transparent">
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
                    backgroundSize: '24px 24px'
                }}></div>
                <div className="absolute right-0 top-0 -translate-y-1/2 translate-x-1/2 opacity-[0.03]">
                    <Users className="h-96 w-96 transform" />
                </div>
            </div>

            <div className="container relative mx-auto px-4">
                <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-end md:gap-8 md:text-left">
                    <Avatar className="h-32 w-32 rounded-2xl border-4 border-background shadow-xl ring-1 ring-border/50">
                        <AvatarImage src={user.image || undefined} alt={user.name || "User"} className="object-cover" />
                        <AvatarFallback className="text-4xl bg-primary/10 text-primary">
                            {user.name?.[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 pb-2">
                        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{user.name || "Anonymous User"}</h1>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground md:justify-start">
                            <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>Joined {formatDate(user.createdAt)}</span>
                            </div>
                        </div>

                        {/* Badges Showcase */}
                        {badges && badges.length > 0 && (
                            <div className="mt-4 flex justify-center md:justify-start">
                                <BadgeShowcase badges={badges} userId={user.id} />
                            </div>
                        )}
                    </div>

                    <div className="flex shrink-0 gap-2 pb-2">
                        {!isOwnProfile ? (
                            <FollowButton followingId={user.id} />
                        ) : (
                            <Link href="/settings">
                                <Badge variant="secondary" className="h-9 px-4 text-sm font-medium hover:bg-muted/80 transition-colors">
                                    Edit Profile
                                </Badge>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
