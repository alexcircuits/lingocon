"use client"

/**
 * StudioDemo — a faithful, fully-interactive 1:1 preview of the LingoCon studio.
 *
 * It reuses the REAL production components (DictionaryTable, DictionaryEntryDialog,
 * SortableSymbol) driven entirely by local in-memory state — no auth, no database,
 * no server actions. Everything resets on refresh. The `.studio-demo-theme` wrapper
 * restores the app's real teal/cream identity so it looks exactly like the live app,
 * even inside the Aurora landing.
 */

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from "@dnd-kit/sortable"
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
    Settings,
    ExternalLink,
    Plus,
    Search,
    Lock,
    Sparkles,
    ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import type { DictionaryEntry } from "@prisma/client"

import { DictionaryTable } from "@/app/studio/lang/[slug]/dictionary/components/dictionary-table"
import { DictionaryEntryDialog } from "@/app/studio/lang/[slug]/dictionary/components/dictionary-entry-dialog"
import { SortableSymbol } from "@/app/studio/lang/[slug]/alphabet/sortable-symbol"
import type { ScriptSymbol } from "@/app/studio/lang/[slug]/alphabet/alphabet-manager"
import {
    DEMO_ENTRIES,
    DEMO_SYMBOLS,
    DEMO_PARADIGM,
    DEMO_LANGUAGE,
} from "./demo-data"

type TabId =
    | "overview"
    | "alphabet"
    | "phonology"
    | "grammar"
    | "dictionary"
    | "paradigms"
    | "sound-changes"
    | "articles"
    | "texts"
    | "flashcards"
    | "settings"

interface TabDef {
    id: TabId
    name: string
    icon: typeof LayoutDashboard
    locked?: boolean
}

const TABS: TabDef[] = [
    { id: "overview", name: "Overview", icon: LayoutDashboard },
    { id: "alphabet", name: "Alphabet", icon: Languages },
    { id: "phonology", name: "Phonology", icon: AudioWaveform, locked: true },
    { id: "grammar", name: "Grammar", icon: BookOpen, locked: true },
    { id: "dictionary", name: "Dictionary", icon: FileText },
    { id: "paradigms", name: "Paradigms", icon: Table2 },
    { id: "sound-changes", name: "Sound Changes", icon: Workflow, locked: true },
    { id: "articles", name: "Articles", icon: Newspaper, locked: true },
    { id: "texts", name: "Texts", icon: BookMarked, locked: true },
    { id: "flashcards", name: "Flashcards", icon: GraduationCap, locked: true },
    { id: "settings", name: "Settings", icon: Settings, locked: true },
]

let idCounter = 0
const newId = () => `demo-new-${idCounter++}`

export function StudioDemo() {
    const [activeTab, setActiveTab] = useState<TabId>("dictionary")

    // ── Dictionary state ──────────────────────────────────────────────
    const [entries, setEntries] = useState<DictionaryEntry[]>(DEMO_ENTRIES)
    const [query, setQuery] = useState("")
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [showLatin, setShowLatin] = useState(false)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editing, setEditing] = useState<DictionaryEntry | null>(null)

    // ── Alphabet state ────────────────────────────────────────────────
    const [symbols, setSymbols] = useState<ScriptSymbol[]>(DEMO_SYMBOLS)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const filteredEntries = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return entries
        return entries.filter(
            (e) =>
                e.lemma.toLowerCase().includes(q) ||
                e.gloss.toLowerCase().includes(q) ||
                (e.ipa ?? "").toLowerCase().includes(q) ||
                (e.partOfSpeech ?? "").toLowerCase().includes(q) ||
                (Array.isArray(e.tags) ? (e.tags as string[]) : []).some((t) =>
                    t.toLowerCase().includes(q),
                ),
        )
    }, [entries, query])

    // ── Dictionary handlers ───────────────────────────────────────────
    const handleAddSubmit = async (data: any) => {
        const created = {
            ...DEMO_ENTRIES[0],
            id: newId(),
            lemma: data.lemma,
            gloss: data.gloss,
            ipa: data.ipa || null,
            partOfSpeech: data.partOfSpeech || null,
            etymology: data.etymology || null,
            notes: data.notes || null,
            relatedWords: data.relatedWords ?? [],
            tags: data.tags ?? [],
            sourceEntryId: null,
        } as unknown as DictionaryEntry
        setEntries((prev) => [created, ...prev])
        setIsAddOpen(false)
        toast.success("Entry added")
    }

    const handleEditSubmit = async (data: any) => {
        if (!editing) return
        setEntries((prev) =>
            prev.map((e) =>
                e.id === editing.id
                    ? ({
                          ...e,
                          lemma: data.lemma,
                          gloss: data.gloss,
                          ipa: data.ipa || null,
                          partOfSpeech: data.partOfSpeech || null,
                          etymology: data.etymology || null,
                          notes: data.notes || null,
                          relatedWords: data.relatedWords ?? [],
                          tags: data.tags ?? [],
                      } as unknown as DictionaryEntry)
                    : e,
            ),
        )
        setIsEditOpen(false)
        setEditing(null)
        toast.success("Entry updated")
    }

    const handleDelete = (id: string) => {
        setEntries((prev) => prev.filter((e) => e.id !== id))
        setSelected((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
        })
        toast.success("Entry deleted")
    }

    const handleEdit = (entry: DictionaryEntry) => {
        setEditing(entry)
        setIsEditOpen(true)
    }

    const handleDerive = (entry: DictionaryEntry) => {
        toast.info(`Derivation wizard opens for “${entry.lemma}” in the full studio.`)
    }

    // ── Alphabet handlers ─────────────────────────────────────────────
    const handleReorder = (id: string, direction: "up" | "down") => {
        setSymbols((prev) => {
            const i = prev.findIndex((s) => s.id === id)
            const j = direction === "up" ? i - 1 : i + 1
            if (j < 0 || j >= prev.length) return prev
            return arrayMove(prev, i, j)
        })
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (over && active.id !== over.id) {
            setSymbols((prev) => {
                const oldIndex = prev.findIndex((s) => s.id === active.id)
                const newIndex = prev.findIndex((s) => s.id === over.id)
                return arrayMove(prev, oldIndex, newIndex)
            })
        }
    }

    const handleDeleteSymbol = (id: string) =>
        setSymbols((prev) => prev.filter((s) => s.id !== id))

    const activeTabDef = TABS.find((t) => t.id === activeTab)!

    return (
        <div className="studio-demo-theme overflow-hidden rounded-[24px] bg-background text-foreground">
            {/* ── Title bar ─────────────────────────────────────────── */}
            <div className="flex h-12 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl">
                <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-400/70" />
                    <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
                    <span className="h-3 w-3 rounded-full bg-green-400/70" />
                </div>
                <div className="ml-2 hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
                    <span>Dashboard</span>
                    <span className="text-muted-foreground/40">/</span>
                    <span className="font-medium text-foreground">{DEMO_LANGUAGE.name}</span>
                    <span className="text-muted-foreground/40">/</span>
                    <span className="font-medium text-foreground">{activeTabDef.name}</span>
                </div>
                <Badge
                    variant="secondary"
                    className="ml-auto gap-1 text-[10px] uppercase tracking-wider"
                >
                    <Sparkles className="h-3 w-3" />
                    Live demo
                </Badge>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 border-border/60 px-2.5 text-xs"
                    asChild
                >
                    <Link href="/login">
                        <ExternalLink className="mr-1.5 h-3 w-3" />
                        <span className="hidden sm:inline">View Public</span>
                    </Link>
                </Button>
            </div>

            {/* ── Mobile tab pills ──────────────────────────────────── */}
            <div className="flex gap-1.5 overflow-x-auto border-b border-border/50 bg-card/40 px-3 py-2 md:hidden">
                {TABS.filter((t) => !t.locked).map((tab) => {
                    const Icon = tab.icon
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                                activeTab === tab.id
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground",
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {tab.name}
                        </button>
                    )
                })}
            </div>

            <div className="flex h-[520px] md:h-[560px]">
                {/* ── Sidebar (desktop) ─────────────────────────────── */}
                <nav className="hidden w-52 shrink-0 overflow-y-auto border-r border-border/50 bg-card/40 p-3 md:block">
                    <div className="mb-3 px-3 py-1">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Studio
                        </h2>
                    </div>
                    <ul className="space-y-1">
                        {TABS.map((tab) => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.id
                            return (
                                <li key={tab.id}>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                                            isActive
                                                ? "bg-primary/10 text-primary"
                                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                        )}
                                    >
                                        <Icon className="h-4 w-4 shrink-0" />
                                        <span className="flex-1 text-left">{tab.name}</span>
                                        {tab.locked && (
                                            <Lock className="h-3 w-3 text-muted-foreground/50" />
                                        )}
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                </nav>

                {/* ── Main panel ────────────────────────────────────── */}
                <main className="thin-scrollbar flex-1 overflow-y-auto bg-background p-4 md:p-6">
                    {activeTab === "dictionary" && (
                        <DictionaryPanel
                            entries={filteredEntries}
                            allEntries={entries}
                            total={entries.length}
                            query={query}
                            onQuery={setQuery}
                            selected={selected}
                            onSelect={setSelected}
                            showLatin={showLatin}
                            onToggleLatin={() => setShowLatin((v) => !v)}
                            symbols={symbols}
                            onAdd={() => setIsAddOpen(true)}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onDerive={handleDerive}
                            onTagClick={(t) => setQuery(t)}
                        />
                    )}

                    {activeTab === "alphabet" && (
                        <AlphabetPanel
                            symbols={symbols}
                            sensors={sensors}
                            onDragEnd={handleDragEnd}
                            onReorder={handleReorder}
                            onDelete={handleDeleteSymbol}
                            onEdit={() =>
                                toast.info("Symbol editor opens in the full studio.")
                            }
                        />
                    )}

                    {activeTab === "paradigms" && <ParadigmPanel />}

                    {activeTab === "overview" && (
                        <OverviewPanel entryCount={entries.length} symbolCount={symbols.length} />
                    )}

                    {activeTabDef.locked && (
                        <LockedPanel name={activeTabDef.name} />
                    )}
                </main>
            </div>

            {/* Dialogs (real production component) */}
            <DictionaryEntryDialog
                open={isAddOpen}
                onOpenChange={setIsAddOpen}
                onSubmit={handleAddSubmit}
                mode="create"
                symbols={symbols as any}
            />
            <DictionaryEntryDialog
                open={isEditOpen}
                onOpenChange={(o) => {
                    setIsEditOpen(o)
                    if (!o) setEditing(null)
                }}
                onSubmit={handleEditSubmit}
                initialData={editing}
                mode="edit"
                symbols={symbols as any}
            />
        </div>
    )
}

/* ───────────────────────── Panels ───────────────────────── */

function PanelHeader({ title, description }: { title: string; description: string }) {
    return (
        <div className="mb-5 border-b border-border/40 pb-4">
            <h1 className="text-2xl font-serif tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
    )
}

function DictionaryPanel(props: {
    entries: DictionaryEntry[]
    allEntries: DictionaryEntry[]
    total: number
    query: string
    onQuery: (q: string) => void
    selected: Set<string>
    onSelect: (s: Set<string>) => void
    showLatin: boolean
    onToggleLatin: () => void
    symbols: ScriptSymbol[]
    onAdd: () => void
    onEdit: (e: DictionaryEntry) => void
    onDelete: (id: string) => void
    onDerive: (e: DictionaryEntry) => void
    onTagClick: (t: string) => void
}) {
    return (
        <div>
            <PanelHeader
                title="Dictionary"
                description={`${props.total} entries · ${DEMO_LANGUAGE.name} lexicon`}
            />
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={props.query}
                        onChange={(e) => props.onQuery(e.target.value)}
                        placeholder="Search lemma, gloss, IPA, tags…"
                        className="pl-9"
                    />
                </div>
                <Button variant="outline" onClick={props.onToggleLatin} className="shrink-0">
                    {props.showLatin ? "Show native" : "Show romanization"}
                </Button>
                <Button onClick={props.onAdd} className="shrink-0">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Entry
                </Button>
            </div>
            <DictionaryTable
                entries={props.entries}
                allEntries={props.allEntries}
                selectedEntries={props.selected}
                onSelectChange={props.onSelect}
                onEdit={props.onEdit}
                onDelete={props.onDelete}
                onDerive={props.onDerive}
                onTagClick={props.onTagClick}
                showLatin={props.showLatin}
                symbols={props.symbols as any}
            />
        </div>
    )
}

function AlphabetPanel(props: {
    symbols: ScriptSymbol[]
    sensors: ReturnType<typeof useSensors>
    onDragEnd: (e: DragEndEvent) => void
    onReorder: (id: string, direction: "up" | "down") => void
    onDelete: (id: string) => void
    onEdit: (s: ScriptSymbol) => void
}) {
    return (
        <div>
            <PanelHeader
                title="Alphabet"
                description="Drag to reorder · manage script symbols, IPA & romanization"
            />
            <DndContext
                sensors={props.sensors}
                collisionDetection={closestCenter}
                onDragEnd={props.onDragEnd}
            >
                <SortableContext
                    items={props.symbols.map((s) => s.id)}
                    strategy={rectSortingStrategy}
                >
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        {props.symbols.map((symbol, index) => (
                            <SortableSymbol
                                key={symbol.id}
                                symbol={symbol}
                                index={index}
                                totalCount={props.symbols.length}
                                isPending={false}
                                onEdit={props.onEdit}
                                onDelete={props.onDelete}
                                onReorder={props.onReorder}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}

function ParadigmPanel() {
    const p = DEMO_PARADIGM
    return (
        <div>
            <PanelHeader title="Paradigms" description="Conjugation & declension tables" />
            <div className="rounded-lg border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h3 className="font-serif text-lg">{p.title}</h3>
                        <p className="text-xs text-muted-foreground">{p.subtitle}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">
                        Class I
                    </Badge>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-20">Person</TableHead>
                            {p.columns.map((c) => (
                                <TableHead key={c}>{c}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {p.rows.map((row) => (
                            <TableRow key={row.person}>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    {row.person}
                                </TableCell>
                                {row.cells.map((cell, i) => (
                                    <TableCell key={i} className="font-medium">
                                        {cell}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

function OverviewPanel({
    entryCount,
    symbolCount,
}: {
    entryCount: number
    symbolCount: number
}) {
    const stats = [
        { label: "Dictionary entries", value: entryCount, icon: FileText },
        { label: "Script symbols", value: symbolCount, icon: Languages },
        { label: "Paradigms", value: 1, icon: Table2 },
        { label: "Grammar pages", value: 4, icon: BookOpen },
    ]
    return (
        <div>
            <PanelHeader
                title={DEMO_LANGUAGE.name}
                description="A naturalistic showcase language · last edited just now"
            />
            <div className="grid grid-cols-2 gap-4">
                {stats.map((s) => {
                    const Icon = s.icon
                    return (
                        <div key={s.label} className="rounded-lg border bg-card p-4">
                            <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Icon className="h-4 w-4" />
                            </div>
                            <div className="font-serif text-2xl">{s.value}</div>
                            <div className="text-xs text-muted-foreground">{s.label}</div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function LockedPanel({ name }: { name: string }) {
    return (
        <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Lock className="h-6 w-6" />
            </div>
            <h3 className="mb-1 font-serif text-xl">{name} lives in the full studio</h3>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                This demo shows a slice of LingoCon. Create a free account to unlock {name.toLowerCase()},
                plus phonology, grammar docs, sound changes, flashcards and more.
            </p>
            <Button asChild>
                <Link href="/login">
                    Start building free
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
        </div>
    )
}
