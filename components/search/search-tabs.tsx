"use client"

import { SearchScope } from "@/lib/services/search"
import { cn } from "@/lib/utils"
import { Globe, BookOpen, FileText, Search, Newspaper, ScrollText } from "lucide-react"

interface SearchTabsProps {
    currentTab: SearchScope
    onTabChange: (tab: SearchScope) => void
    counts: {
        all: number
        languages: number
        dictionary: number
        grammar: number
        articles: number
        texts: number
    }
}

export function SearchTabs({ currentTab, onTabChange, counts }: SearchTabsProps) {
    const tabs: { id: SearchScope; label: string; icon: React.ReactNode }[] = [
        { id: "all", label: "All", icon: <Search className="h-4 w-4" /> },
        { id: "languages", label: "Languages", icon: <Globe className="h-4 w-4" /> },
        { id: "dictionary", label: "Dictionary", icon: <BookOpen className="h-4 w-4" /> },
        { id: "grammar", label: "Grammar", icon: <FileText className="h-4 w-4" /> },
        { id: "articles", label: "Articles", icon: <Newspaper className="h-4 w-4" /> },
        { id: "texts", label: "Texts", icon: <ScrollText className="h-4 w-4" /> },
    ]

    return (
        <div className="w-full border-b border-border/40">
            <div className="flex items-center gap-1 overflow-x-auto px-4 md:px-0 md:ml-[140px]">
                {tabs.map((tab) => {
                    const isActive = currentTab === tab.id
                    const count = counts[tab.id]
                    
                    // Hide tabs with 0 results (except "All")
                    if (tab.id !== "all" && count === 0) return null

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={cn(
                                "relative flex items-center gap-1.5 px-3 pb-3 pt-3 text-sm whitespace-nowrap transition-colors",
                                isActive
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            
                            {isActive && (
                                <span className="absolute bottom-0 left-0 w-full h-[3px] bg-primary rounded-t-full" />
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
