"use client"

import { useEffect, useState } from "react"
import { getPlatformUpdates } from "@/app/actions/platform-update"
import { getRecentAchievements } from "@/app/actions/badge"
import {
    Bell,
    Sparkles,
    Info,
    Star,
    Zap,
    Gift,
    Search,
    Languages,
    Book,
    FileText,
    Medal
} from "lucide-react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type PlatformUpdate = {
    id: string
    title: string
    description: string
    icon: string | null
    link: string | null
    createdAt: Date
}

type NotificationItem = {
    id: string
    type: 'update' | 'achievement'
    title: string
    description: string
    icon: any
    link?: string | null
    createdAt: Date
    data?: any
}

export function NotificationCenter() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([])
    const [loading, setLoading] = useState(true)
    const [isOpen, setIsOpen] = useState(false)
    const [hasNew, setHasNew] = useState(false)

    const fetchData = async () => {
        try {
            const [updatesResult, achievements] = await Promise.all([
                getPlatformUpdates(5),
                getRecentAchievements(undefined, 48) // check last 48 hours
            ])

            let allItems: NotificationItem[] = []

            if (updatesResult.success && updatesResult.data) {
                const updates = updatesResult.data.map((u: any) => ({
                    id: u.id,
                    type: 'update' as const,
                    title: u.title,
                    description: u.description,
                    icon: getIconByName(u.icon),
                    link: u.link,
                    createdAt: new Date(u.createdAt)
                }))
                allItems = [...allItems, ...updates]
            }

            if (achievements && achievements.length > 0) {
                const badges = achievements.map((b: any) => ({
                    id: `badge-${b.id}-${b.earnedAt}`,
                    type: 'achievement' as const,
                    title: `Earned '${b.name}' Badge`,
                    description: b.description,
                    icon: Medal,
                    link: null, // Could link to profile badges tab if we had current userId in context
                    createdAt: new Date(b.earnedAt)
                }))
                allItems = [...allItems, ...badges]
            }

            // Sort by date desc
            allItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            setNotifications(allItems)

            // Check for new items since last seen
            if (allItems.length > 0) {
                const lastSeenId = localStorage.getItem("lingocon_last_seen_notification")
                const latestId = allItems[0].id

                if (latestId && latestId !== lastSeenId) {
                    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
                    const isRecent = allItems[0].createdAt > threeDaysAgo
                    if (isRecent) setHasNew(true)
                }
            }

        } catch (error) {
            console.error("Failed to fetch notifications:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    return (
        <Popover open={isOpen} onOpenChange={(open) => {
            setIsOpen(open)
            if (open) {
                setHasNew(false)
                if (notifications.length > 0) {
                    localStorage.setItem("lingocon_last_seen_notification", notifications[0].id)
                }
            }
        }}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full hover:bg-muted/50 transition-colors">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    {hasNew && (
                        <span className="absolute top-2 right-2 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[350px] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl">
                <div className="flex items-center justify-between p-4 border-b border-border/40 bg-muted/30">
                    <h3 className="text-sm font-semibold">Notifications</h3>
                </div>
                <ScrollArea className="h-[400px]">
                    {loading ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
                    ) : notifications.length > 0 ? (
                        <div className="divide-y divide-border/40">
                            {notifications.map((item) => (
                                <div key={item.id} className="p-4 flex gap-4 hover:bg-muted/50 transition-colors">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <item.icon className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-medium leading-none">{item.title}</p>
                                        <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                                        <p className="text-[10px] text-muted-foreground pt-1">
                                            {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-muted-foreground">
                            <Bell className="mx-auto h-8 w-8 opacity-20 mb-2" />
                            <p className="text-sm">No notifications</p>
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
}

function getIconByName(name: string | null) {
    switch (name?.toLowerCase()) {
        case "sparkles": return Sparkles
        case "zap": return Zap
        case "star": return Star
        case "gift": return Gift
        case "info": return Info
        case "search": return Search
        case "languages": return Languages
        case "book": return Book
        case "file-text": return FileText
        case "medal": return Medal
        default: return Info
    }
}
