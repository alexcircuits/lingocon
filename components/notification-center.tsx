"use client"

import { useEffect, useState } from "react"
import { getPlatformUpdates } from "@/app/actions/platform-update"
import {
    Bell,
    Sparkles,
    ChevronRight,
    Info,
    Star,
    Zap,
    Gift,
    Search,
    Languages,
    Book,
    FileText
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

type PlatformUpdate = {
    id: string
    title: string
    description: string
    icon: string | null
    link: string | null
    createdAt: Date
}

export function NotificationCenter() {
    const [updates, setUpdates] = useState<PlatformUpdate[]>([])
    const [loading, setLoading] = useState(true)
    const [isOpen, setIsOpen] = useState(false)
    const [hasNew, setHasNew] = useState(false)

    const fetchUpdates = async () => {
        try {
            const result = await getPlatformUpdates(5)
            if (result.success && result.data) {
                // @ts-ignore
                setUpdates(result.data)
                // Check if there are updates from the last 24 hours to show the badge
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
                const newUpdates = result.data.some((u: PlatformUpdate) => new Date(u.createdAt) > oneDayAgo)
                setHasNew(newUpdates)
            }
        } catch (error) {
            console.error("Failed to fetch platform updates:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUpdates()
    }, [])

    return (
        <Popover open={isOpen} onOpenChange={(open) => {
            setIsOpen(open)
            if (open) setHasNew(false) // Clear badge when opened
        }}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 rounded-full hover:bg-muted/50 transition-colors"
                >
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    {hasNew && (
                        <span className="absolute top-2 right-2 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                    )}
                    <span className="sr-only">Platform Updates</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[350px] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl">
                <div className="flex items-center justify-between p-4 border-b border-border/40 bg-muted/30">
                    <div>
                        <h3 className="text-sm font-semibold">What's New</h3>
                        <p className="text-[10px] text-muted-foreground">Latest feature announcements</p>
                    </div>
                    <Sparkles className="h-4 w-4 text-primary opacity-50" />
                </div>
                <ScrollArea className="h-[400px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-2">
                            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs text-muted-foreground">Fetching updates...</p>
                        </div>
                    ) : updates.length > 0 ? (
                        <div className="divide-y divide-border/40">
                            {updates.map((update) => (
                                <UpdateItem
                                    key={update.id}
                                    update={update}
                                    onClick={() => setIsOpen(false)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-60 text-center p-6">
                            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                                <Bell className="h-6 w-6 text-muted-foreground/30" />
                            </div>
                            <p className="text-sm font-medium text-foreground/80">All caught up!</p>
                            <p className="text-xs text-muted-foreground mt-1 text-balance">
                                Check back later for new feature announcements.
                            </p>
                        </div>
                    )}
                </ScrollArea>
                {updates.length > 0 && (
                    <div className="p-3 border-t border-border/40 bg-muted/20 text-center">
                        <p className="text-[10px] text-muted-foreground">
                            Thank you for using LingoCon!
                        </p>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}

function UpdateItem({ update, onClick }: { update: PlatformUpdate; onClick: () => void }) {
    const Icon = getIconByName(update.icon)

    const content = (
        <div className="flex gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="text-[13px] font-semibold truncate text-foreground/90">
                        {update.title}
                    </h4>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {update.description}
                </p>
            </div>
        </div>
    )

    if (update.link) {
        return (
            <Link
                href={update.link}
                className="block p-4 hover:bg-muted/50 transition-colors"
                onClick={onClick}
            >
                {content}
            </Link>
        )
    }

    return (
        <div className="p-4 bg-background">
            {content}
        </div>
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
        default: return Info
    }
}
