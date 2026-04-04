"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "sonner"
import {
    AudioWaveform,
    Save,
    Info,
    Pencil,
    RotateCcw,
    Plus,
    X,
} from "lucide-react"
import { updateLanguage } from "@/app/actions/language"
import { IPAKeyboard } from "@/components/ipa-keyboard"
import {
    CONSONANT_PLACES,
    CONSONANT_MANNERS,
    IPA_CONSONANT_MAP,
    VOWEL_HEIGHTS,
    VOWEL_BACKNESS,
    IPA_VOWEL_MAP,
} from "@/lib/data/ipa-data"
import type { Language, ScriptSymbol } from "@prisma/client"


interface PhonologyViewProps {
    language: Language
    symbols: ScriptSymbol[]
}

export function PhonologyView({ language, symbols }: PhonologyViewProps) {
    const metadata = (language.metadata as any) || {}
    const [syllableStructure, setSyllableStructure] = useState(metadata.syllableStructure || "")
    const [allophonyRules, setAllophonyRules] = useState(metadata.allophonyRules || "")
    const [isSaving, setIsSaving] = useState(false)

    // Manual override state
    const savedOverride = metadata.phonologyOverride
    const [isEditing, setIsEditing] = useState(false)
    const [overrideEnabled, setOverrideEnabled] = useState(savedOverride?.enabled || false)
    const [customConsonants, setCustomConsonants] = useState<string[]>(savedOverride?.consonants || [])
    const [customVowels, setCustomVowels] = useState<string[]>(savedOverride?.vowels || [])
    const [addPopoverOpen, setAddPopoverOpen] = useState(false)
    const [addingTo, setAddingTo] = useState<"consonants" | "vowels">("consonants")

    // Extract IPA symbols from script symbols (auto-detect)
    const autoDetectedIPA = useMemo(() => {
        const ipas = new Set<string>()
        const allKnownIPA = [
            ...Object.keys(IPA_CONSONANT_MAP),
            ...Object.keys(IPA_VOWEL_MAP),
        ].sort((a, b) => b.length - a.length)

        symbols.forEach((s) => {
            if (s.ipa) {
                const cleaned = s.ipa.replace(/[\/\[\]]/g, "").trim()
                if (IPA_CONSONANT_MAP[cleaned] || IPA_VOWEL_MAP[cleaned]) {
                    ipas.add(cleaned)
                } else {
                    let remaining = cleaned
                    while (remaining.length > 0) {
                        let matched = false
                        for (const key of allKnownIPA) {
                            if (remaining.startsWith(key)) {
                                ipas.add(key)
                                remaining = remaining.slice(key.length)
                                matched = true
                                break
                            }
                        }
                        if (!matched) {
                            remaining = remaining.slice(1)
                        }
                    }
                }
            }
        })
        return ipas
    }, [symbols])

    // Determine effective phoneme sets based on override
    const ipaSymbols = useMemo(() => {
        if (overrideEnabled && (customConsonants.length > 0 || customVowels.length > 0)) {
            return new Set([...customConsonants, ...customVowels])
        }
        return autoDetectedIPA
    }, [overrideEnabled, customConsonants, customVowels, autoDetectedIPA])

    // Initialize custom sets from auto-detected when entering edit mode for the first time
    const handleStartEditing = useCallback(() => {
        if (!overrideEnabled) {
            // First time entering manual mode - seed from auto-detected
            const autoConsonants = Array.from(autoDetectedIPA).filter(s => IPA_CONSONANT_MAP[s])
            const autoVowels = Array.from(autoDetectedIPA).filter(s => IPA_VOWEL_MAP[s])
            setCustomConsonants(autoConsonants)
            setCustomVowels(autoVowels)
            setOverrideEnabled(true)
        }
        setIsEditing(true)
    }, [overrideEnabled, autoDetectedIPA])

    const handleResetToAuto = useCallback(() => {
        setOverrideEnabled(false)
        setCustomConsonants([])
        setCustomVowels([])
        setIsEditing(false)
    }, [])

    const handleRemovePhoneme = useCallback((ipa: string) => {
        if (IPA_CONSONANT_MAP[ipa]) {
            setCustomConsonants(prev => prev.filter(s => s !== ipa))
        }
        if (IPA_VOWEL_MAP[ipa]) {
            setCustomVowels(prev => prev.filter(s => s !== ipa))
        }
    }, [])

    const handleAddPhoneme = useCallback((symbol: string) => {
        // Strip combining tie bar for affricate matching
        const cleaned = symbol.replace(/\u0361/g, "")
        if (addingTo === "consonants" && IPA_CONSONANT_MAP[cleaned]) {
            setCustomConsonants(prev => prev.includes(cleaned) ? prev : [...prev, cleaned])
        } else if (addingTo === "vowels" && IPA_VOWEL_MAP[cleaned]) {
            setCustomVowels(prev => prev.includes(cleaned) ? prev : [...prev, cleaned])
        } else if (IPA_CONSONANT_MAP[cleaned]) {
            setCustomConsonants(prev => prev.includes(cleaned) ? prev : [...prev, cleaned])
        } else if (IPA_VOWEL_MAP[cleaned]) {
            setCustomVowels(prev => prev.includes(cleaned) ? prev : [...prev, cleaned])
        } else {
            toast.error("This symbol is not recognized as a consonant or vowel in the chart")
        }
    }, [addingTo])

    // Build consonant chart data
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

    // Build vowel chart data
    const vowelChart = useMemo(() => {
        const vowels: Array<{ ipa: string; height: string; backness: string; rounded: boolean }> = []

        ipaSymbols.forEach((ipa) => {
            const info = IPA_VOWEL_MAP[ipa]
            if (info) {
                vowels.push({ ipa, ...info })
            }
        })

        return vowels
    }, [ipaSymbols])

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const result = await updateLanguage({
                id: language.id,
                metadata: {
                    ...metadata,
                    syllableStructure,
                    allophonyRules,
                    phonologyOverride: overrideEnabled
                        ? { enabled: true, consonants: customConsonants, vowels: customVowels }
                        : { enabled: false },
                },
            })
            if (result && 'error' in result) {
                toast.error(result.error)
            } else {
                toast.success("Phonology settings saved")
                setIsEditing(false)
            }
        } catch {
            toast.error("Failed to save")
        } finally {
            setIsSaving(false)
        }
    }

    const consonantCount = Array.from(ipaSymbols).filter((s) => IPA_CONSONANT_MAP[s]).length
    const vowelCount = Array.from(ipaSymbols).filter((s) => IPA_VOWEL_MAP[s]).length

    return (
        <div className="space-y-8">
            {/* Stats & Edit Controls */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex gap-4 flex-wrap">
                    <Badge variant="outline" className="text-sm px-3 py-1.5 gap-2">
                        <AudioWaveform className="h-3.5 w-3.5" />
                        {consonantCount} consonants
                    </Badge>
                    <Badge variant="outline" className="text-sm px-3 py-1.5 gap-2">
                        {vowelCount} vowels
                    </Badge>
                    <Badge variant="outline" className="text-sm px-3 py-1.5 gap-2">
                        {ipaSymbols.size} total phonemes
                    </Badge>
                    {overrideEnabled && (
                        <Badge variant="secondary" className="text-sm px-3 py-1.5 gap-2">
                            Manual override
                        </Badge>
                    )}
                </div>
                <div className="flex gap-2">
                    {!isEditing ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleStartEditing}
                            className="gap-2"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit Inventory
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleResetToAuto}
                                className="gap-2 text-muted-foreground"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reset to Auto
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditing(false)}
                            >
                                Done Editing
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {isEditing && (
                <Card className="border-dashed border-primary/30 bg-primary/5">
                    <CardContent className="py-4 text-sm text-muted-foreground flex items-start gap-2">
                        <Info className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>
                            Click the <X className="h-3 w-3 inline" /> next to a sound to remove it. Use the &quot;Add Sound&quot; buttons below each chart to add new phonemes via the IPA keyboard. Click &quot;Save Phonology&quot; to persist your changes.
                        </span>
                    </CardContent>
                </Card>
            )}

            {ipaSymbols.size === 0 && (
                <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                        <Info className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-muted-foreground">
                            No IPA data found. Add IPA values to your alphabet symbols to auto-generate the phonology charts, or click &quot;Edit Inventory&quot; to manually build your phoneme inventory.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Consonant Chart */}
            {(consonantChart.manners.length > 0 || isEditing) && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-serif">Consonant Inventory</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {consonantChart.manners.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="text-left p-2 border-b border-border/60 text-xs text-muted-foreground font-medium">
                                                Manner
                                            </th>
                                            {consonantChart.places.map((place) => (
                                                <th
                                                    key={place}
                                                    colSpan={2}
                                                    className="p-2 border-b border-border/60 text-xs text-muted-foreground font-medium text-center"
                                                >
                                                    {place}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {consonantChart.manners.map((manner) => (
                                            <tr key={manner} className="border-b border-border/20">
                                                <td className="p-2 text-xs text-muted-foreground font-medium whitespace-nowrap">
                                                    {manner}
                                                </td>
                                                {consonantChart.places.map((place) => {
                                                    const cell = consonantChart.chart[manner]?.[place]
                                                    return (
                                                        <td
                                                            key={`${manner}-${place}`}
                                                            colSpan={2}
                                                            className="p-2 text-center"
                                                        >
                                                            <div className="flex justify-center gap-3">
                                                                {cell?.voiceless && (
                                                                    <span className="font-mono text-base text-foreground inline-flex items-center gap-1 group">
                                                                        <span className="cursor-default hover:text-primary transition-colors" title={`${place} voiceless ${manner.toLowerCase()}`}>
                                                                            {cell.voiceless}
                                                                        </span>
                                                                        {isEditing && (
                                                                            <button
                                                                                onClick={() => handleRemovePhoneme(cell.voiceless!)}
                                                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                                                                                title="Remove"
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </button>
                                                                        )}
                                                                    </span>
                                                                )}
                                                                {cell?.voiced && (
                                                                    <span className="font-mono text-base text-foreground inline-flex items-center gap-1 group">
                                                                        <span className="cursor-default hover:text-primary transition-colors" title={`${place} voiced ${manner.toLowerCase()}`}>
                                                                            {cell.voiced}
                                                                        </span>
                                                                        {isEditing && (
                                                                            <button
                                                                                onClick={() => handleRemovePhoneme(cell.voiced!)}
                                                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                                                                                title="Remove"
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </button>
                                                                        )}
                                                                    </span>
                                                                )}
                                                                {!cell && (
                                                                    <span className="text-muted-foreground/20">·</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No consonants in inventory. Add some using the button below.
                            </p>
                        )}

                        {isEditing && (
                            <Popover
                                open={addPopoverOpen && addingTo === "consonants"}
                                onOpenChange={(open) => {
                                    setAddPopoverOpen(open)
                                    if (open) setAddingTo("consonants")
                                }}
                            >
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-2">
                                        <Plus className="h-3.5 w-3.5" />
                                        Add Consonant
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    align="start"
                                    sideOffset={8}
                                    className="w-auto p-0"
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                >
                                    <IPAKeyboard
                                        onSelect={handleAddPhoneme}
                                        onClose={() => setAddPopoverOpen(false)}
                                        currentValue=""
                                    />
                                </PopoverContent>
                            </Popover>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Vowel Chart */}
            {(vowelChart.length > 0 || isEditing) && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-serif">Vowel Inventory</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {vowelChart.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="text-left p-2 border-b border-border/60 text-xs text-muted-foreground font-medium">
                                                Height
                                            </th>
                                            {VOWEL_BACKNESS.map((b) => (
                                                <th
                                                    key={b}
                                                    className="p-2 border-b border-border/60 text-xs text-muted-foreground font-medium text-center"
                                                >
                                                    {b}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {VOWEL_HEIGHTS.map((height) => {
                                            const hasRow = vowelChart.some((v) => v.height === height)
                                            if (!hasRow) return null
                                            return (
                                                <tr key={height} className="border-b border-border/20">
                                                    <td className="p-2 text-xs text-muted-foreground font-medium">
                                                        {height}
                                                    </td>
                                                    {VOWEL_BACKNESS.map((backness) => {
                                                        const vowels = vowelChart
                                                            .filter((v) => v.height === height && v.backness === backness)
                                                            .sort((a, b) => Number(a.rounded) - Number(b.rounded)) // unrounded first, then rounded
                                                        return (
                                                            <td key={`${height}-${backness}`} className="p-2 text-center">
                                                                {vowels.length > 0 ? (
                                                                    <div className="flex justify-center gap-2">
                                                                        {vowels.map((v) => (
                                                                            <span
                                                                                key={v.ipa}
                                                                                className="font-mono text-base inline-flex items-center gap-1 group"
                                                                            >
                                                                                <span
                                                                                    className="cursor-default hover:text-primary transition-colors"
                                                                                    title={`${v.height} ${v.backness.toLowerCase()} ${v.rounded ? "rounded" : "unrounded"} vowel`}
                                                                                >
                                                                                    {v.ipa}
                                                                                </span>
                                                                                {isEditing && (
                                                                                    <button
                                                                                        onClick={() => handleRemovePhoneme(v.ipa)}
                                                                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                                                                                        title="Remove"
                                                                                    >
                                                                                        <X className="h-3 w-3" />
                                                                                    </button>
                                                                                )}
                                                                            </span>
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
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No vowels in inventory. Add some using the button below.
                            </p>
                        )}

                        {isEditing && (
                            <Popover
                                open={addPopoverOpen && addingTo === "vowels"}
                                onOpenChange={(open) => {
                                    setAddPopoverOpen(open)
                                    if (open) setAddingTo("vowels")
                                }}
                            >
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-2">
                                        <Plus className="h-3.5 w-3.5" />
                                        Add Vowel
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    align="start"
                                    sideOffset={8}
                                    className="w-auto p-0"
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                >
                                    <IPAKeyboard
                                        onSelect={handleAddPhoneme}
                                        onClose={() => setAddPopoverOpen(false)}
                                        currentValue=""
                                    />
                                </PopoverContent>
                            </Popover>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Syllable Structure */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-serif">Syllable Structure</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="syllable" className="text-sm">
                            Syllable Template
                        </Label>
                        <Input
                            id="syllable"
                            value={syllableStructure}
                            onChange={(e) => setSyllableStructure(e.target.value)}
                            placeholder="(C)(C)V(C)  — C = consonant, V = vowel, () = optional"
                            className="font-mono"
                        />
                        <p className="text-xs text-muted-foreground">
                            Use C for consonant slots, V for vowel slots. Parentheses mark optional positions.
                            Examples: CV, CVC, (C)CV(C)(C)
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Allophony Rules */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-serif">Phonological Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="allophony" className="text-sm">
                            Allophony & Sound Rules
                        </Label>
                        <Textarea
                            id="allophony"
                            value={allophonyRules}
                            onChange={(e) => setAllophonyRules(e.target.value)}
                            placeholder={`/t/ → [tʰ] / #_V  (aspiration word-initially before vowels)\n/s/ → [z] / V_V  (voicing between vowels)\n/n/ → [ŋ] / _k  (place assimilation before velars)`}
                            className="font-mono text-sm min-h-[120px]"
                            rows={5}
                        />
                        <p className="text-xs text-muted-foreground">
                            Write one rule per line. Format: /phoneme/ → [allophone] / environment
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    <Save className="h-4 w-4" />
                    {isSaving ? "Saving..." : "Save Phonology"}
                </Button>
            </div>
        </div>
    )
}
