"use client"

import { type ReactNode } from "react"
import {
    Search,
    PenTool,
    BookOpen,
    Library,
    AudioWaveform,
    Share2,
    FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Marquee } from "@/components/ui/marquee"
import { BorderBeam } from "@/components/ui/border-beam"
import { TypingSearchDemo } from "@/components/landing/typing-search-demo"
import { DEMO_SYMBOLS, DEMO_PARADIGM } from "@/components/landing/studio-demo/demo-data"

function Cell({
    className,
    title,
    description,
    Icon,
    visual,
    wide = false,
    beam = false,
}: {
    className?: string
    title: string
    description: string
    Icon: React.ElementType
    visual: ReactNode
    wide?: boolean
    beam?: boolean
}) {
    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-3xl aurora-glass p-6 md:p-7",
                wide ? "flex flex-col gap-5 md:flex-row md:items-center md:gap-7" : "flex flex-col gap-5",
                className,
            )}
        >
            <div className={cn(wide && "md:w-[38%] md:shrink-0")}>
                <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary backdrop-blur-sm">
                    <Icon className="h-5 w-5" />
                </span>
                <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
                <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                    {description}
                </p>
            </div>
            <div className={cn("relative min-h-0", wide ? "md:flex-1" : "flex-1")}>{visual}</div>
            {beam && <BorderBeam size={140} duration={9} className="opacity-70" />}
        </div>
    )
}

const FORMAT_CHIPS = ["PDF", "Word .docx", "Excel", "CSV", "JSON", "Anki deck", "LaTeX"]
const PHON_CHIPS = ["p", "t", "k", "m", "n", "s", "θ", "l", "r", "a", "e", "i", "o", "u"]

const IGT_TOKENS = [
    { word: "aelra", gloss: "soar-3SG" },
    { word: "miror", gloss: "star.NOM" },
    { word: "kuna", gloss: "blue-ADJ" },
]

function ScriptVisual() {
    return (
        <div className="grid grid-cols-4 gap-2">
            {DEMO_SYMBOLS.slice(0, 8).map((s) => (
                <div
                    key={s.id}
                    className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card/70 py-2.5"
                >
                    <span className="text-xl leading-none">{s.symbol}</span>
                    <span className="mt-1 font-mono text-[9px] text-muted-foreground">/{s.ipa}/</span>
                </div>
            ))}
        </div>
    )
}

function GrammarVisual() {
    return (
        <div className="rounded-2xl border border-border/50 bg-card/70 p-4">
            <div className="flex gap-5">
                {IGT_TOKENS.map((t) => (
                    <div key={t.word}>
                        <div className="font-semibold leading-none">{t.word}</div>
                        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-primary">
                            {t.gloss}
                        </div>
                    </div>
                ))}
            </div>
            <p className="mt-4 border-t border-border/40 pt-3 text-xs italic text-muted-foreground">
                &ldquo;The star soars, blue.&rdquo;
            </p>
        </div>
    )
}

function ParadigmVisual() {
    const cols = DEMO_PARADIGM.columns
    const rows = DEMO_PARADIGM.rows.slice(0, 4)
    return (
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/70">
            <table className="w-full text-left text-xs">
                <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                        <th className="px-3 py-2 font-medium" />
                        {cols.map((c) => (
                            <th key={c} className="px-3 py-2 font-medium">{c}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.person} className="border-b border-border/30 last:border-0">
                            <td className="px-3 py-2 font-mono text-[11px] text-primary">{r.person}</td>
                            {r.cells.map((cell, i) => (
                                <td key={i} className="px-3 py-2 font-medium">{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function PhonologyVisual() {
    return (
        <div className="flex flex-wrap content-center gap-2">
            {PHON_CHIPS.map((c) => (
                <span
                    key={c}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/70 font-mono text-sm"
                >
                    {c}
                </span>
            ))}
        </div>
    )
}

function ExportVisual() {
    return (
        <div className="flex flex-col justify-center gap-3">
            <Marquee className="[--duration:22s]" pauseOnHover>
                {FORMAT_CHIPS.map((c) => (
                    <span
                        key={c}
                        className="flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-4 py-2 text-sm font-medium text-foreground"
                    >
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        {c}
                    </span>
                ))}
            </Marquee>
            <Marquee className="[--duration:26s]" reverse pauseOnHover>
                {["Eldarin", "Aelin", "Vesk", "Tóran", "Myari", "Sólen"].map((c) => (
                    <span
                        key={c}
                        className="rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary"
                    >
                        {c}
                    </span>
                ))}
            </Marquee>
        </div>
    )
}

export function FeatureBento() {
    return (
        <div className="grid auto-rows-[minmax(20rem,auto)] grid-cols-1 gap-5 md:grid-cols-3">
            <Cell
                className="md:col-span-2"
                wide
                beam
                title="Smart Dictionary"
                description="Instant search, IPA, part-of-speech, etymologies and live derivation trees — a lexicon that scales to thousands of words."
                Icon={Search}
                visual={<TypingSearchDemo />}
            />
            <Cell
                title="Custom Scripts"
                description="Design a writing system with IPA mapping and romanization."
                Icon={PenTool}
                visual={<ScriptVisual />}
            />
            <Cell
                title="Grammar & Glossing"
                description="Rich grammar docs with interlinear glossing, linked to your lexicon."
                Icon={BookOpen}
                visual={<GrammarVisual />}
            />
            <Cell
                className="md:col-span-2"
                wide
                beam
                title="Morphology Tables"
                description="Build conjugation and declension paradigms with reusable slots that generate inflected forms automatically."
                Icon={Library}
                visual={<ParadigmVisual />}
            />
            <Cell
                title="Phonology & Sound Change"
                description="Define inventories, syllable structure and sound-change rules."
                Icon={AudioWaveform}
                visual={<PhonologyVisual />}
            />
            <Cell
                className="md:col-span-2"
                wide
                title="Built to share & export"
                description="Publish to the community, connect a family tree, and export anywhere — your data is always yours."
                Icon={Share2}
                visual={<ExportVisual />}
            />
        </div>
    )
}
