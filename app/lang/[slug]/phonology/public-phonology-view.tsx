"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AudioWaveform, Info } from "lucide-react"
import type { Language, ScriptSymbol } from "@prisma/client"

// IPA consonant chart
const CONSONANT_PLACES = [
    "Bilabial", "Labiodental", "Dental", "Alveolar", "Postalveolar",
    "Retroflex", "Palatal", "Velar", "Uvular", "Pharyngeal", "Glottal"
]

const CONSONANT_MANNERS = [
    "Plosive", "Nasal", "Trill", "Tap/Flap", "Fricative",
    "Lateral fricative", "Approximant", "Lateral approximant"
]

const IPA_CONSONANT_MAP: Record<string, { place: string; manner: string; voiced: boolean }> = {
    "p": { place: "Bilabial", manner: "Plosive", voiced: false },
    "b": { place: "Bilabial", manner: "Plosive", voiced: true },
    "t": { place: "Alveolar", manner: "Plosive", voiced: false },
    "d": { place: "Alveolar", manner: "Plosive", voiced: true },
    "ʈ": { place: "Retroflex", manner: "Plosive", voiced: false },
    "ɖ": { place: "Retroflex", manner: "Plosive", voiced: true },
    "c": { place: "Palatal", manner: "Plosive", voiced: false },
    "ɟ": { place: "Palatal", manner: "Plosive", voiced: true },
    "k": { place: "Velar", manner: "Plosive", voiced: false },
    "g": { place: "Velar", manner: "Plosive", voiced: true },
    "ɡ": { place: "Velar", manner: "Plosive", voiced: true },
    "q": { place: "Uvular", manner: "Plosive", voiced: false },
    "ɢ": { place: "Uvular", manner: "Plosive", voiced: true },
    "ʔ": { place: "Glottal", manner: "Plosive", voiced: false },
    "m": { place: "Bilabial", manner: "Nasal", voiced: true },
    "ɱ": { place: "Labiodental", manner: "Nasal", voiced: true },
    "n": { place: "Alveolar", manner: "Nasal", voiced: true },
    "ɳ": { place: "Retroflex", manner: "Nasal", voiced: true },
    "ɲ": { place: "Palatal", manner: "Nasal", voiced: true },
    "ŋ": { place: "Velar", manner: "Nasal", voiced: true },
    "ɴ": { place: "Uvular", manner: "Nasal", voiced: true },
    "ʙ": { place: "Bilabial", manner: "Trill", voiced: true },
    "r": { place: "Alveolar", manner: "Trill", voiced: true },
    "ʀ": { place: "Uvular", manner: "Trill", voiced: true },
    "ⱱ": { place: "Labiodental", manner: "Tap/Flap", voiced: true },
    "ɾ": { place: "Alveolar", manner: "Tap/Flap", voiced: true },
    "ɽ": { place: "Retroflex", manner: "Tap/Flap", voiced: true },
    "ɸ": { place: "Bilabial", manner: "Fricative", voiced: false },
    "β": { place: "Bilabial", manner: "Fricative", voiced: true },
    "f": { place: "Labiodental", manner: "Fricative", voiced: false },
    "v": { place: "Labiodental", manner: "Fricative", voiced: true },
    "θ": { place: "Dental", manner: "Fricative", voiced: false },
    "ð": { place: "Dental", manner: "Fricative", voiced: true },
    "s": { place: "Alveolar", manner: "Fricative", voiced: false },
    "z": { place: "Alveolar", manner: "Fricative", voiced: true },
    "ʃ": { place: "Postalveolar", manner: "Fricative", voiced: false },
    "ʒ": { place: "Postalveolar", manner: "Fricative", voiced: true },
    "ʂ": { place: "Retroflex", manner: "Fricative", voiced: false },
    "ʐ": { place: "Retroflex", manner: "Fricative", voiced: true },
    "ç": { place: "Palatal", manner: "Fricative", voiced: false },
    "ʝ": { place: "Palatal", manner: "Fricative", voiced: true },
    "x": { place: "Velar", manner: "Fricative", voiced: false },
    "ɣ": { place: "Velar", manner: "Fricative", voiced: true },
    "χ": { place: "Uvular", manner: "Fricative", voiced: false },
    "ʁ": { place: "Uvular", manner: "Fricative", voiced: true },
    "ħ": { place: "Pharyngeal", manner: "Fricative", voiced: false },
    "ʕ": { place: "Pharyngeal", manner: "Fricative", voiced: true },
    "h": { place: "Glottal", manner: "Fricative", voiced: false },
    "ɦ": { place: "Glottal", manner: "Fricative", voiced: true },
    "ɬ": { place: "Alveolar", manner: "Lateral fricative", voiced: false },
    "ɮ": { place: "Alveolar", manner: "Lateral fricative", voiced: true },
    "ʋ": { place: "Labiodental", manner: "Approximant", voiced: true },
    "ɹ": { place: "Alveolar", manner: "Approximant", voiced: true },
    "ɻ": { place: "Retroflex", manner: "Approximant", voiced: true },
    "j": { place: "Palatal", manner: "Approximant", voiced: true },
    "ɰ": { place: "Velar", manner: "Approximant", voiced: true },
    "l": { place: "Alveolar", manner: "Lateral approximant", voiced: true },
    "ɭ": { place: "Retroflex", manner: "Lateral approximant", voiced: true },
    "ʎ": { place: "Palatal", manner: "Lateral approximant", voiced: true },
    "ʟ": { place: "Velar", manner: "Lateral approximant", voiced: true },
    "w": { place: "Velar", manner: "Approximant", voiced: true },
}

const VOWEL_HEIGHTS = ["Close", "Near-close", "Close-mid", "Mid", "Open-mid", "Near-open", "Open"]
const VOWEL_BACKNESS = ["Front", "Central", "Back"]

const IPA_VOWEL_MAP: Record<string, { height: string; backness: string; rounded: boolean }> = {
    "i": { height: "Close", backness: "Front", rounded: false },
    "y": { height: "Close", backness: "Front", rounded: true },
    "ɨ": { height: "Close", backness: "Central", rounded: false },
    "ʉ": { height: "Close", backness: "Central", rounded: true },
    "ɯ": { height: "Close", backness: "Back", rounded: false },
    "u": { height: "Close", backness: "Back", rounded: true },
    "ɪ": { height: "Near-close", backness: "Front", rounded: false },
    "ʏ": { height: "Near-close", backness: "Front", rounded: true },
    "ʊ": { height: "Near-close", backness: "Back", rounded: true },
    "e": { height: "Close-mid", backness: "Front", rounded: false },
    "ø": { height: "Close-mid", backness: "Front", rounded: true },
    "ɘ": { height: "Close-mid", backness: "Central", rounded: false },
    "ɵ": { height: "Close-mid", backness: "Central", rounded: true },
    "ɤ": { height: "Close-mid", backness: "Back", rounded: false },
    "o": { height: "Close-mid", backness: "Back", rounded: true },
    "ə": { height: "Mid", backness: "Central", rounded: false },
    "ɛ": { height: "Open-mid", backness: "Front", rounded: false },
    "œ": { height: "Open-mid", backness: "Front", rounded: true },
    "ɜ": { height: "Open-mid", backness: "Central", rounded: false },
    "ɞ": { height: "Open-mid", backness: "Central", rounded: true },
    "ʌ": { height: "Open-mid", backness: "Back", rounded: false },
    "ɔ": { height: "Open-mid", backness: "Back", rounded: true },
    "æ": { height: "Near-open", backness: "Front", rounded: false },
    "ɐ": { height: "Near-open", backness: "Central", rounded: false },
    "a": { height: "Open", backness: "Front", rounded: false },
    "ɶ": { height: "Open", backness: "Front", rounded: true },
    "ɑ": { height: "Open", backness: "Back", rounded: false },
    "ɒ": { height: "Open", backness: "Back", rounded: true },
}

interface PublicPhonologyViewProps {
    language: Language
    symbols: ScriptSymbol[]
}

export function PublicPhonologyView({ language, symbols }: PublicPhonologyViewProps) {
    const metadata = (language.metadata as any) || {}

    const ipaSymbols = useMemo(() => {
        const ipas = new Set<string>()
        symbols.forEach((s) => {
            if (s.ipa) {
                const cleaned = s.ipa.replace(/[\/\[\]]/g, "").trim()
                if (IPA_CONSONANT_MAP[cleaned] || IPA_VOWEL_MAP[cleaned]) {
                    ipas.add(cleaned)
                } else {
                    for (const char of cleaned) {
                        if (IPA_CONSONANT_MAP[char] || IPA_VOWEL_MAP[char]) {
                            ipas.add(char)
                        }
                    }
                }
            }
        })
        return ipas
    }, [symbols])

    const consonantChart = useMemo(() => {
        const chart: Record<string, Record<string, { voiceless?: string; voiced?: string }>> = {}
        const usedPlaces = new Set<string>()
        const usedManners = new Set<string>()

        ipaSymbols.forEach((ipa) => {
            const info = IPA_CONSONANT_MAP[ipa]
            if (info) {
                usedPlaces.add(info.place)
                usedManners.add(info.manner)
                if (!chart[info.manner]) chart[info.manner] = {}
                if (!chart[info.manner][info.place]) chart[info.manner][info.place] = {}
                if (info.voiced) {
                    chart[info.manner][info.place].voiced = ipa
                } else {
                    chart[info.manner][info.place].voiceless = ipa
                }
            }
        })

        return {
            chart,
            places: CONSONANT_PLACES.filter((p) => usedPlaces.has(p)),
            manners: CONSONANT_MANNERS.filter((m) => usedManners.has(m)),
        }
    }, [ipaSymbols])

    const vowelChart = useMemo(() => {
        const vowels: Array<{ ipa: string; height: string; backness: string; rounded: boolean }> = []
        ipaSymbols.forEach((ipa) => {
            const info = IPA_VOWEL_MAP[ipa]
            if (info) vowels.push({ ipa, ...info })
        })
        return vowels
    }, [ipaSymbols])

    const consonantCount = Array.from(ipaSymbols).filter((s) => IPA_CONSONANT_MAP[s]).length
    const vowelCount = Array.from(ipaSymbols).filter((s) => IPA_VOWEL_MAP[s]).length

    if (ipaSymbols.size === 0 && !metadata.syllableStructure && !metadata.allophonyRules) {
        return (
            <div className="rounded-lg border border-dashed p-12 text-center">
                <p className="text-muted-foreground">
                    Phonology data has not been added yet.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {ipaSymbols.size > 0 && (
                <div className="flex gap-3 flex-wrap">
                    <Badge variant="outline" className="text-sm px-3 py-1.5 gap-2">
                        <AudioWaveform className="h-3.5 w-3.5" />
                        {consonantCount} consonants
                    </Badge>
                    <Badge variant="outline" className="text-sm px-3 py-1.5 gap-2">
                        {vowelCount} vowels
                    </Badge>
                </div>
            )}

            {consonantChart.manners.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-serif">Consonant Inventory</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr>
                                    <th className="text-left p-2 border-b border-border/60 text-xs text-muted-foreground font-medium">Manner</th>
                                    {consonantChart.places.map((place) => (
                                        <th key={place} colSpan={2} className="p-2 border-b border-border/60 text-xs text-muted-foreground font-medium text-center">{place}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {consonantChart.manners.map((manner) => (
                                    <tr key={manner} className="border-b border-border/20">
                                        <td className="p-2 text-xs text-muted-foreground font-medium whitespace-nowrap">{manner}</td>
                                        {consonantChart.places.map((place) => {
                                            const cell = consonantChart.chart[manner]?.[place]
                                            return (
                                                <td key={`${manner}-${place}`} colSpan={2} className="p-2 text-center">
                                                    <div className="flex justify-center gap-3">
                                                        {cell?.voiceless && <span className="font-mono text-base" title={`${place} voiceless ${manner.toLowerCase()}`}>{cell.voiceless}</span>}
                                                        {cell?.voiced && <span className="font-mono text-base" title={`${place} voiced ${manner.toLowerCase()}`}>{cell.voiced}</span>}
                                                        {!cell && <span className="text-muted-foreground/20">·</span>}
                                                    </div>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {vowelChart.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-serif">Vowel Inventory</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr>
                                    <th className="text-left p-2 border-b border-border/60 text-xs text-muted-foreground font-medium">Height</th>
                                    {VOWEL_BACKNESS.map((b) => (
                                        <th key={b} className="p-2 border-b border-border/60 text-xs text-muted-foreground font-medium text-center">{b}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {VOWEL_HEIGHTS.map((height) => {
                                    const hasRow = vowelChart.some((v) => v.height === height)
                                    if (!hasRow) return null
                                    return (
                                        <tr key={height} className="border-b border-border/20">
                                            <td className="p-2 text-xs text-muted-foreground font-medium">{height}</td>
                                            {VOWEL_BACKNESS.map((backness) => {
                                                const vowels = vowelChart.filter((v) => v.height === height && v.backness === backness)
                                                return (
                                                    <td key={`${height}-${backness}`} className="p-2 text-center">
                                                        {vowels.length > 0 ? (
                                                            <div className="flex justify-center gap-2">
                                                                {vowels.map((v) => (
                                                                    <span key={v.ipa} className="font-mono text-base" title={`${v.height} ${v.backness.toLowerCase()} ${v.rounded ? "rounded" : "unrounded"} vowel`}>{v.ipa}</span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground/20">·</span>
                                                        )}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {metadata.syllableStructure && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-serif">Syllable Structure</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <code className="text-lg font-mono bg-muted/50 px-3 py-1.5 rounded-md">{metadata.syllableStructure}</code>
                    </CardContent>
                </Card>
            )}

            {metadata.allophonyRules && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-serif">Phonological Rules</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="text-sm font-mono whitespace-pre-wrap text-foreground/80">{metadata.allophonyRules}</pre>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
