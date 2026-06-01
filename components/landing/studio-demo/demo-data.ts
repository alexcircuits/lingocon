import type { DictionaryEntry } from "@prisma/client"
import type { ScriptSymbol } from "@/app/studio/lang/[slug]/alphabet/alphabet-manager"

/**
 * A curated showcase conlang — "Aelin" — used only by the interactive landing
 * demo. Not a real user's language. Shapes mirror the production Prisma models
 * so the demo can feed the real studio components verbatim.
 */

export const DEMO_LANGUAGE = {
    id: "demo-lang",
    name: "Aelin",
    slug: "aelin",
}

const now = new Date("2026-01-01T00:00:00Z")

function symbol(
    order: number,
    s: string,
    ipa: string,
    latin: string,
    name: string,
    capital?: string,
): ScriptSymbol {
    return {
        id: `sym-${order}`,
        symbol: s,
        capitalSymbol: capital ?? null,
        ipa,
        latin,
        name,
        order,
        languageId: DEMO_LANGUAGE.id,
        createdAt: now,
        updatedAt: now,
    }
}

export const DEMO_SYMBOLS: ScriptSymbol[] = [
    symbol(0, "○", "a", "a", "ena"),
    symbol(1, "△", "e", "e", "ela"),
    symbol(2, "▽", "i", "i", "ira"),
    symbol(3, "◇", "o", "o", "ova"),
    symbol(4, "⬡", "u", "u", "ula"),
    symbol(5, "✦", "k", "k", "kel"),
    symbol(6, "□", "l", "l", "lor"),
    symbol(7, "◈", "m", "m", "mun"),
    symbol(8, "▲", "n", "n", "nai"),
    symbol(9, "●", "r", "r", "rho"),
    symbol(10, "◆", "s", "s", "sil"),
    symbol(11, "⬢", "t", "t", "tav"),
]

function entry(data: {
    id: string
    lemma: string
    gloss: string
    ipa?: string
    partOfSpeech?: string
    etymology?: string
    notes?: string
    tags?: string[]
    relatedWords?: string[]
    sourceEntryId?: string | null
}): DictionaryEntry {
    return {
        id: data.id,
        lemma: data.lemma,
        gloss: data.gloss,
        ipa: data.ipa ?? null,
        partOfSpeech: data.partOfSpeech ?? null,
        etymology: data.etymology ?? null,
        notes: data.notes ?? null,
        tags: data.tags ?? [],
        relatedWords: data.relatedWords ?? [],
        sourceEntryId: data.sourceEntryId ?? null,
        languageId: DEMO_LANGUAGE.id,
        createdAt: now,
        updatedAt: now,
        // Fields that exist on the model but are unused by the demo UI.
        audioUrl: null,
    } as unknown as DictionaryEntry
}

export const DEMO_ENTRIES: DictionaryEntry[] = [
    entry({
        id: "e-aelin",
        lemma: "aelin",
        gloss: "sky; the open heavens",
        ipa: "ˈae.lin",
        partOfSpeech: "noun",
        etymology: "From the proto-root *ael ‘open air’.",
        tags: ["nature", "sky"],
        relatedWords: ["lumi", "miror"],
    }),
    entry({
        id: "e-aelra",
        lemma: "aelra",
        gloss: "to soar, to fly",
        ipa: "ˈael.ra",
        partOfSpeech: "verb",
        etymology: "Derived from aelin (sky) + the verbal suffix -ra.",
        tags: ["motion"],
        sourceEntryId: "e-aelin",
    }),
    entry({
        id: "e-kuna",
        lemma: "kuna",
        gloss: "blue; deep, vast",
        ipa: "ˈku.na",
        partOfSpeech: "adjective",
        tags: ["color"],
    }),
    entry({
        id: "e-lumi",
        lemma: "lumi",
        gloss: "light; radiance",
        ipa: "ˈlu.mi",
        partOfSpeech: "noun",
        tags: ["nature", "light"],
        relatedWords: ["miror"],
    }),
    entry({
        id: "e-miror",
        lemma: "miror",
        gloss: "star",
        ipa: "ˈmi.ror",
        partOfSpeech: "noun",
        etymology: "Likely from lumi (light) with the agentive -or.",
        tags: ["nature", "sky"],
        sourceEntryId: "e-lumi",
    }),
    entry({
        id: "e-tave",
        lemma: "tave",
        gloss: "to see, to perceive",
        ipa: "ˈta.ve",
        partOfSpeech: "verb",
        tags: ["sense"],
    }),
    entry({
        id: "e-nethe",
        lemma: "nethe",
        gloss: "river",
        ipa: "ˈne.θe",
        partOfSpeech: "noun",
        tags: ["nature", "water"],
    }),
    entry({
        id: "e-sora",
        lemma: "sora",
        gloss: "song; melody",
        ipa: "ˈso.ra",
        partOfSpeech: "noun",
        tags: ["culture"],
    }),
]

export interface DemoParadigm {
    title: string
    subtitle: string
    columns: string[]
    rows: { person: string; cells: string[] }[]
}

export const DEMO_PARADIGM: DemoParadigm = {
    title: "tave — “to see”",
    subtitle: "Class I verb · regular conjugation",
    columns: ["Present", "Past", "Future"],
    rows: [
        { person: "1sg", cells: ["taveo", "tavë", "tavaro"] },
        { person: "2sg", cells: ["taves", "tavest", "tavaras"] },
        { person: "3sg", cells: ["tavet", "tavit", "tavarat"] },
        { person: "1pl", cells: ["tavemu", "tavimu", "tavaramu"] },
        { person: "2pl", cells: ["tavetu", "tavitu", "tavaratu"] },
        { person: "3pl", cells: ["tavent", "tavint", "tavarant"] },
    ],
}
