"use client"

import Link from "next/link"
import { formatDate } from "@/lib/utils"
import { Calendar, Languages, Users, User, Medal } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FollowButton } from "@/components/follow-button"
import { BadgeShowcase } from "@/components/badges"
import { BadgeData } from "@/components/badges/badge-card"
import { Separator } from "@/components/ui/separator"

interface ProfileSidebarProps {
    user: {
        id: string
        name: string | null
        email: string | null
        image: string | null
        createdAt: Date
    }
    stats: {
        languages: number
        followers: number
        following: number
    }
    isOwnProfile: boolean
    badges: BadgeData[]
}

export function ProfileSidebar({ user, stats, isOwnProfile, badges }: ProfileSidebarProps) {
    return (
        <div className="flex flex-col gap-6 -mt-20 md:-mt-32 relative z-10 px-4 md:px-0">
            {/* Avatar & Basic Info */}
            <div className="flex flex-col gap-4">
                <Avatar className="h-32 w-32 md:h-40 md:w-40 rounded-2xl shadow-xl">
                    <AvatarImage src={user.image || undefined} alt={user.name || "User"} className="object-cover" />
                    <AvatarFallback className="text-4xl md:text-5xl bg-primary/10 text-primary">
                        {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                </Avatar>

                <div className="space-y-1">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{user.name || "Anonymous User"}</h1>
                    <p className="text-muted-foreground">{user.email}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    {!isOwnProfile ? (
                        <FollowButton followingId={user.id} className="w-full" />
                    ) : (
                        <Link href="/settings" className="w-full">
                            <Button variant="outline" className="w-full">
                                Edit Profile
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            <Separator />

            {/* Stats Grid - Compact for Sidebar */}
            <div className="grid grid-cols-3 gap-2 py-2">
                <div className="flex flex-col items-center p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                    <span className="text-xl font-bold">{stats.languages}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Langs</span>
                </div>
                <div className="flex flex-col items-center p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                    <span className="text-xl font-bold">{stats.followers}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Followers</span>
                </div>
                <div className="flex flex-col items-center p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                    <span className="text-xl font-bold">{stats.following}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Following</span>
                </div>
            </div>

            <Separator />

            {/* Meta Info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Joined {formatDate(user.createdAt)}</span>
            </div>

            {/* Badges Showcase - Sidebar Version */}
            {badges && badges.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium flex items-center gap-2">
                            <Medal className="h-4 w-4 text-primary" />
                            Top Achievements
                        </h3>
                        {/* Determine if we should show a view all link based on badge count */}
                    </div>
                    <div className="bg-card border rounded-xl p-4 shadow-sm">
                        <BadgeShowcase badges={badges} userId={user.id} maxDisplay={4} className="justify-between" />
                    </div>
                </div>
            )}
        </div>
    )
}
