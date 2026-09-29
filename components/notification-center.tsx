"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { getPlatformUpdates } from "@/app/actions/platform-update"
import { getRecentAchievements } from "@/app/actions/badge"
import {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationsRead,
} from "@/app/actions/notification"
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
    Medal,
    UserPlus,
    Heart,
    MessageSquare
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
import { isSafeHttpUrlOrPath } from "@/lib/utils/safe-url"

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
    type: 'update' | 'achievement' | 'personal'
    title: string
    description: string
    icon: any
    link?: string | null
    createdAt: Date
    data?: any
}

export function NotificationCenter() {
    const t = useTranslations("notifications")
    const [notifications, setNotifications] = useState<NotificationItem[]>([])
    const [loading, setLoading] = useState(true)
    const [isOpen, setIsOpen] = useState(false)
    const [hasNew, setHasNew] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)

    const fetchData = async () => {
        try {
            const [updatesResult, achievements, personalResult, unreadResult] = await Promise.all([
                getPlatformUpdates(5),
                getRecentAchievements(undefined, 48), // check last 48 hours
                getNotifications(15),
                getUnreadNotificationCount(),
            ])

            let allItems: NotificationItem[] = []

            if (updatesResult.success && updatesResult.data) {
                const updates = updatesResult.data.map((u: any) => ({
                    id: u.id,
                    type: 'update' as const,
                    title: u.title,
                    description: u.description,
                    icon: getIconByName(u.icon),
                    // Announcements created before link validation existed may hold unsafe URLs.
                    link: u.link && isSafeHttpUrlOrPath(u.link.trim()) ? u.link : null,
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

            if (personalResult.data && personalResult.data.length > 0) {
                const personal = personalResult.data.map((n: any) => {
                    const d = n.data || {}
                    const actor = d.actorName || "Someone"
                    const language = d.languageName || ""
                    let title = t("title")
                    let description = ""
                    let icon: any = Info
                    switch (n.type) {
                        case "NEW_FOLLOWER":
                            title = t("newFollower", { actor }); icon = UserPlus; break
                        case "LANGUAGE_FAVORITED":
                            title = t("languageFavorited", { actor, language }); icon = Heart; break
                        case "NEW_COMMENT":
                            title = t("newComment", { language }); description = d.excerpt || ""; icon = MessageSquare; break
                        case "COMMENT_REPLY":
                            title = t("commentReply", { actor }); description = d.excerpt || ""; icon = MessageSquare; break
                    }
                    return {
                        id: `notif-${n.id}`,
                        type: 'personal' as const,
                        title,
                        description,
                        icon,
                        link: d.href ?? null,
                        createdAt: new Date(n.createdAt),
                    }
                })
                allItems = [...allItems, ...personal]
            }

            // Sort by date desc
            allItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            setNotifications(allItems)

            // The bell dot is driven by genuinely unread personal notifications
            // (DB-backed), falling back to the platform-update / badge recency
            // heuristic so those still ping.
            const unread = unreadResult.count ?? 0
            setUnreadCount(unread)
            let showDot = unread > 0

            if (!showDot && allItems.length > 0) {
                const lastSeenId = localStorage.getItem("lingocon_last_seen_notification")
                const latestId = allItems[0].id
                if (latestId && latestId !== lastSeenId) {
                    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
                    if (allItems[0].createdAt > threeDaysAgo) showDot = true
                }
            }
            setHasNew(showDot)

        } catch (error) {
            console.error("Failed to fetch notifications:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        // Load once on mount; later refreshes are explicit (opening the popover).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <Popover open={isOpen} onOpenChange={(open) => {
            setIsOpen(open)
            if (open) {
                setHasNew(false)
                if (notifications.length > 0) {
                    localStorage.setItem("lingocon_last_seen_notification", notifications[0].id)
                }
                if (unreadCount > 0) {
                    setUnreadCount(0)
                    markNotificationsRead().catch((e) => console.error("Failed to mark notifications read:", e))
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
                    <h3 className="text-sm font-semibold">{t("title")}</h3>
                </div>
                <ScrollArea className="h-[400px]">
                    {loading ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">{t("loading")}</div>
                    ) : notifications.length > 0 ? (
                        <div className="divide-y divide-border/40">
                            {notifications.map((item) => {
                                const content = (
                                    <div className="p-4 flex gap-4 hover:bg-muted/50 transition-colors">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <item.icon className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <p className="text-sm font-medium leading-none">{item.title}</p>
                                            {item.description && (
                                                <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground pt-1">
                                                {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                                            </p>
                                        </div>
                                    </div>
                                )
                                return item.link ? (
                                    <Link key={item.id} href={item.link} onClick={() => setIsOpen(false)} className="block">
                                        {content}
                                    </Link>
                                ) : (
                                    <div key={item.id}>{content}</div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-muted-foreground">
                            <Bell className="mx-auto h-8 w-8 opacity-20 mb-2" />
                            <p className="text-sm">{t("empty")}</p>
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
