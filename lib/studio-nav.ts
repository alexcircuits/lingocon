import {
    LayoutDashboard,
    Languages,
    AudioWaveform,
    Workflow,
    BookOpen,
    FileText,
    Table2,
    Newspaper,
    BookMarked,
    GraduationCap,
    Blocks,
    Settings,
} from "lucide-react"
import type { ComponentType } from "react"

export interface StudioTab {
    name: string
    /** Path segment appended to the language base path. Empty string = overview. */
    segment: string
    icon: ComponentType<{ className?: string }>
    /** Surfaced in the mobile bottom navigation bar. */
    primary?: boolean
}

/** Single source of truth for studio navigation (sidebar, mobile drawer, bottom bar). */
export const STUDIO_TABS: StudioTab[] = [
    { name: "Overview", segment: "", icon: LayoutDashboard, primary: true },
    { name: "Alphabet", segment: "alphabet", icon: Languages, primary: true },
    { name: "Phonology", segment: "phonology", icon: AudioWaveform },
    { name: "Sound Changes", segment: "sound-changes", icon: Workflow },
    { name: "Grammar", segment: "grammar", icon: BookOpen, primary: true },
    { name: "Dictionary", segment: "dictionary", icon: FileText, primary: true },
    { name: "Paradigms", segment: "paradigms", icon: Table2 },
    { name: "Articles", segment: "articles", icon: Newspaper },
    { name: "Texts", segment: "texts", icon: BookMarked },
    { name: "Flashcards", segment: "flashcards", icon: GraduationCap },
    { name: "Modules", segment: "modules", icon: Blocks },
    { name: "Settings", segment: "settings", icon: Settings },
]

/**
 * A studio-panel tab contributed by an installed module. Computed on the server
 * (from the user's enabled STUDIO_PANEL installs) and threaded into the nav.
 */
export interface ModuleNavTab {
    name: string
    href: string
    /** Lucide icon name or emoji, resolved by `ModuleIcon`. */
    icon?: string | null
}

export function tabHref(basePath: string, segment: string): string {
    return segment ? `${basePath}/${segment}` : basePath
}

export function isTabActive(pathname: string, basePath: string, segment: string): boolean {
    const href = tabHref(basePath, segment)
    return pathname === href || (segment !== "" && pathname.startsWith(href))
}

/** Best-match active tab for the current pathname (used for the mobile section title). */
export function getActiveTab(pathname: string, basePath: string): StudioTab | undefined {
    // Prefer the most specific (non-overview) match before falling back to overview.
    const nonOverview = STUDIO_TABS.filter((t) => t.segment !== "")
    const match = nonOverview.find((t) => isTabActive(pathname, basePath, t.segment))
    if (match) return match
    return STUDIO_TABS[0]
}
