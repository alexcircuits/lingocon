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
    ListChecks,
    Blocks,
    Settings,
    Puzzle,
    Globe,
} from "lucide-react"
import type { ComponentType } from "react"

export interface StudioTab {
    name: string
    /** i18n key under `studio.tabs`. Consumers should prefer this over `name`. */
    i18nKey: string
    /** Path segment appended to the language base path. Empty string = overview. */
    segment: string
    icon: ComponentType<{ className?: string }>
    /** Surfaced in the mobile bottom navigation bar. */
    primary?: boolean
}

/** Single source of truth for studio navigation (sidebar, mobile drawer, bottom bar). */
export const STUDIO_TABS: StudioTab[] = [
    { name: "Overview", i18nKey: "overview", segment: "", icon: LayoutDashboard, primary: true },
    { name: "Alphabet", i18nKey: "alphabet", segment: "alphabet", icon: Languages, primary: true },
    { name: "Phonology", i18nKey: "phonology", segment: "phonology", icon: AudioWaveform },
    { name: "Sound Changes", i18nKey: "soundChanges", segment: "sound-changes", icon: Workflow },
    { name: "Grammar", i18nKey: "grammar", segment: "grammar", icon: BookOpen, primary: true },
    { name: "Dictionary", i18nKey: "dictionary", segment: "dictionary", icon: FileText, primary: true },
    { name: "Paradigms", i18nKey: "paradigms", segment: "paradigms", icon: Table2 },
    { name: "Articles", i18nKey: "articles", segment: "articles", icon: Newspaper },
    { name: "Texts", i18nKey: "texts", segment: "texts", icon: BookMarked },
    { name: "Courses", i18nKey: "courses", segment: "courses", icon: ListChecks },
    { name: "Flashcards", i18nKey: "flashcards", segment: "flashcards", icon: GraduationCap },
    { name: "Translate", i18nKey: "translate", segment: "translate", icon: Globe },
    { name: "Modules", i18nKey: "modules", segment: "modules", icon: Blocks },
    { name: "Settings", i18nKey: "settings", segment: "settings", icon: Settings },
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

/** Maps a tab segment to the write permission required to edit its content. Tabs without an entry are always fully accessible. */
export const TAB_WRITE_PERMISSION: Record<string, string> = {
  alphabet: "write:alphabet",
  phonology: "write:phonology",
  "sound-changes": "write:phonology",
  grammar: "write:grammar",
  dictionary: "write:dictionary",
  paradigms: "write:paradigms",
  articles: "write:articles",
  texts: "write:texts",
  modules: "manage:modules",
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
