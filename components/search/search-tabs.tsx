"use client"

import { SearchScope } from "@/lib/services/search"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { BookOpen, FileText, Globe, LayoutGrid } from "lucide-react"

interface SearchTabsProps {
    currentTab: SearchScope
    onTabChange: (tab: SearchScope) => void
    counts: {
        all: number
        languages: number
        dictionary: number
        grammar: number
    }
}

export function SearchTabs({ currentTab, onTabChange, counts }: SearchTabsProps) {
    const tabs: { id: SearchScope; label: string; icon: React.ReactNode }[] = [
        { id: "all", label: "All Results", icon: <LayoutGrid className="h-4 w-4" /> },
        { id: "languages", label: "Languages", icon: <Globe className="h-4 w-4" /> },
        { id: "dictionary", label: "Dictionary", icon: <FileText className="h-4 w-4" /> },
        { id: "grammar", label: "Grammar", icon: <BookOpen className="h-4 w-4" /> },
    ]

    return (
        <div className="mb-8 flex w-full items-center justify-start gap-2 overflow-x-auto pb-2 md:justify-center">
            <div className="flex gap-2 rounded-xl bg-muted/30 p-1">
                {tabs.map((tab) => (
                    <Button
                        key={tab.id}
                        variant="ghost"
                        size="sm"
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                            "gap-2 rounded-lg px-4 text-muted-foreground transition-all hover:text-foreground",
                            currentTab === tab.id &&
                            "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                        )}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                        <span className="ml-1 rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70">
                            {counts[tab.id] || 0}
                        </span>
                    </Button>
                ))}
            </div>
        </div>
    )
}
