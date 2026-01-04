"use client"

import { useState, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Search, X, Volume2, Loader2, Delete } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// IPA character data organized by category
const IPA_CONSONANTS = [
    // Pulmonic consonants organized by manner and place
    { symbol: "p", name: "voiceless bilabial plosive" },
    { symbol: "b", name: "voiced bilabial plosive" },
    { symbol: "t", name: "voiceless alveolar plosive" },
    { symbol: "d", name: "voiced alveolar plosive" },
    { symbol: "ʈ", name: "voiceless retroflex plosive" },
    { symbol: "ɖ", name: "voiced retroflex plosive" },
    { symbol: "c", name: "voiceless palatal plosive" },
    { symbol: "ɟ", name: "voiced palatal plosive" },
    { symbol: "k", name: "voiceless velar plosive" },
    { symbol: "g", name: "voiced velar plosive" },
    { symbol: "q", name: "voiceless uvular plosive" },
    { symbol: "ɢ", name: "voiced uvular plosive" },
    { symbol: "ʔ", name: "glottal stop" },
    // Nasals
    { symbol: "m", name: "bilabial nasal" },
    { symbol: "ɱ", name: "labiodental nasal" },
    { symbol: "n", name: "alveolar nasal" },
    { symbol: "ɳ", name: "retroflex nasal" },
    { symbol: "ɲ", name: "palatal nasal" },
    { symbol: "ŋ", name: "velar nasal" },
    { symbol: "ɴ", name: "uvular nasal" },
    // Trills
    { symbol: "ʙ", name: "bilabial trill" },
    { symbol: "r", name: "alveolar trill" },
    { symbol: "ʀ", name: "uvular trill" },
    // Taps/Flaps
    { symbol: "ⱱ", name: "labiodental flap" },
    { symbol: "ɾ", name: "alveolar tap" },
    { symbol: "ɽ", name: "retroflex flap" },
    // Fricatives
    { symbol: "ɸ", name: "voiceless bilabial fricative" },
    { symbol: "β", name: "voiced bilabial fricative" },
    { symbol: "f", name: "voiceless labiodental fricative" },
    { symbol: "v", name: "voiced labiodental fricative" },
    { symbol: "θ", name: "voiceless dental fricative" },
    { symbol: "ð", name: "voiced dental fricative" },
    { symbol: "s", name: "voiceless alveolar fricative" },
    { symbol: "z", name: "voiced alveolar fricative" },
    { symbol: "ʃ", name: "voiceless postalveolar fricative" },
    { symbol: "ʒ", name: "voiced postalveolar fricative" },
    { symbol: "ʂ", name: "voiceless retroflex fricative" },
    { symbol: "ʐ", name: "voiced retroflex fricative" },
    { symbol: "ç", name: "voiceless palatal fricative" },
    { symbol: "ʝ", name: "voiced palatal fricative" },
    { symbol: "x", name: "voiceless velar fricative" },
    { symbol: "ɣ", name: "voiced velar fricative" },
    { symbol: "χ", name: "voiceless uvular fricative" },
    { symbol: "ʁ", name: "voiced uvular fricative" },
    { symbol: "ħ", name: "voiceless pharyngeal fricative" },
    { symbol: "ʕ", name: "voiced pharyngeal fricative" },
    { symbol: "h", name: "voiceless glottal fricative" },
    { symbol: "ɦ", name: "voiced glottal fricative" },
    // Lateral fricatives
    { symbol: "ɬ", name: "voiceless alveolar lateral fricative" },
    { symbol: "ɮ", name: "voiced alveolar lateral fricative" },
    // Approximants
    { symbol: "ʋ", name: "labiodental approximant" },
    { symbol: "ɹ", name: "alveolar approximant" },
    { symbol: "ɻ", name: "retroflex approximant" },
    { symbol: "j", name: "palatal approximant" },
    { symbol: "ɰ", name: "velar approximant" },
    // Lateral approximants
    { symbol: "l", name: "alveolar lateral approximant" },
    { symbol: "ɭ", name: "retroflex lateral approximant" },
    { symbol: "ʎ", name: "palatal lateral approximant" },
    { symbol: "ʟ", name: "velar lateral approximant" },
    // Other consonants
    { symbol: "ʍ", name: "voiceless labial-velar fricative" },
    { symbol: "w", name: "labial-velar approximant" },
    { symbol: "ɥ", name: "labial-palatal approximant" },
    { symbol: "ʜ", name: "voiceless epiglottal fricative" },
    { symbol: "ʢ", name: "voiced epiglottal fricative" },
    { symbol: "ʡ", name: "epiglottal plosive" },
    // Co-articulated
    { symbol: "ɕ", name: "voiceless alveolo-palatal fricative" },
    { symbol: "ʑ", name: "voiced alveolo-palatal fricative" },
    { symbol: "ɧ", name: "voiceless sj-sound" },
    // Affricates
    { symbol: "t͡s", name: "voiceless alveolar affricate" },
    { symbol: "d͡z", name: "voiced alveolar affricate" },
    { symbol: "t͡ʃ", name: "voiceless postalveolar affricate" },
    { symbol: "d͡ʒ", name: "voiced postalveolar affricate" },
    { symbol: "t͡ɕ", name: "voiceless alveolo-palatal affricate" },
    { symbol: "d͡ʑ", name: "voiced alveolo-palatal affricate" },
    { symbol: "ʈ͡ʂ", name: "voiceless retroflex affricate" },
    { symbol: "ɖ͡ʐ", name: "voiced retroflex affricate" },
    { symbol: "p͡f", name: "voiceless labiodental affricate" },
    { symbol: "b͡v", name: "voiced labiodental affricate" },
    { symbol: "k͡x", name: "voiceless velar affricate" },
    { symbol: "g͡ɣ", name: "voiced velar affricate" },
]

const IPA_VOWELS = [
    // Close vowels
    { symbol: "i", name: "close front unrounded vowel" },
    { symbol: "y", name: "close front rounded vowel" },
    { symbol: "ɨ", name: "close central unrounded vowel" },
    { symbol: "ʉ", name: "close central rounded vowel" },
    { symbol: "ɯ", name: "close back unrounded vowel" },
    { symbol: "u", name: "close back rounded vowel" },
    // Near-close vowels
    { symbol: "ɪ", name: "near-close front unrounded vowel" },
    { symbol: "ʏ", name: "near-close front rounded vowel" },
    { symbol: "ʊ", name: "near-close back rounded vowel" },
    // Close-mid vowels
    { symbol: "e", name: "close-mid front unrounded vowel" },
    { symbol: "ø", name: "close-mid front rounded vowel" },
    { symbol: "ɘ", name: "close-mid central unrounded vowel" },
    { symbol: "ɵ", name: "close-mid central rounded vowel" },
    { symbol: "ɤ", name: "close-mid back unrounded vowel" },
    { symbol: "o", name: "close-mid back rounded vowel" },
    // Mid vowels
    { symbol: "ə", name: "mid central vowel (schwa)" },
    // Open-mid vowels
    { symbol: "ɛ", name: "open-mid front unrounded vowel" },
    { symbol: "œ", name: "open-mid front rounded vowel" },
    { symbol: "ɜ", name: "open-mid central unrounded vowel" },
    { symbol: "ɞ", name: "open-mid central rounded vowel" },
    { symbol: "ʌ", name: "open-mid back unrounded vowel" },
    { symbol: "ɔ", name: "open-mid back rounded vowel" },
    // Near-open vowels
    { symbol: "æ", name: "near-open front unrounded vowel" },
    { symbol: "ɐ", name: "near-open central vowel" },
    // Open vowels
    { symbol: "a", name: "open front unrounded vowel" },
    { symbol: "ɶ", name: "open front rounded vowel" },
    { symbol: "ä", name: "open central unrounded vowel" },
    { symbol: "ɑ", name: "open back unrounded vowel" },
    { symbol: "ɒ", name: "open back rounded vowel" },
]

const IPA_DIACRITICS = [
    // Voicing
    { symbol: "̥", name: "voiceless", combining: true },
    { symbol: "̬", name: "voiced", combining: true },
    { symbol: "ʰ", name: "aspirated" },
    // Syllabicity
    { symbol: "̩", name: "syllabic", combining: true },
    { symbol: "̯", name: "non-syllabic", combining: true },
    // Release
    { symbol: "ʷ", name: "labialized" },
    { symbol: "ʲ", name: "palatalized" },
    { symbol: "ˠ", name: "velarized" },
    { symbol: "ˤ", name: "pharyngealized" },
    { symbol: "ⁿ", name: "nasal release" },
    { symbol: "ˡ", name: "lateral release" },
    { symbol: "˺", name: "no audible release" },
    // Phonation
    { symbol: "̤", name: "breathy voiced", combining: true },
    { symbol: "̰", name: "creaky voiced", combining: true },
    // Tongue root
    { symbol: "̈", name: "centralized", combining: true },
    { symbol: "̽", name: "mid-centralized", combining: true },
    { symbol: "̘", name: "advanced tongue root", combining: true },
    { symbol: "̙", name: "retracted tongue root", combining: true },
    // Articulation
    { symbol: "̟", name: "advanced", combining: true },
    { symbol: "̠", name: "retracted", combining: true },
    { symbol: "̪", name: "dental", combining: true },
    { symbol: "̺", name: "apical", combining: true },
    { symbol: "̻", name: "laminal", combining: true },
    { symbol: "̃", name: "nasalized", combining: true },
    { symbol: "̼", name: "linguolabial", combining: true },
    { symbol: "̹", name: "more rounded", combining: true },
    { symbol: "̜", name: "less rounded", combining: true },
    { symbol: "̝", name: "raised", combining: true },
    { symbol: "̞", name: "lowered", combining: true },
    // Rhoticity
    { symbol: "˞", name: "rhoticity" },
    { symbol: "ɚ", name: "rhoticized schwa" },
    { symbol: "ɝ", name: "rhoticized open-mid central" },
    // Tones (Tone letters)
    { symbol: "˥", name: "extra high" },
    { symbol: "˦", name: "high" },
    { symbol: "˧", name: "mid" },
    { symbol: "˨", name: "low" },
    { symbol: "˩", name: "extra low" },
    { symbol: "꜖", name: "extra low" },
    { symbol: "꜒", name: "high" },
    { symbol: "ʼ", name: "ejective" },
    { symbol: "˪", name: "lateral release" },
]

const IPA_SUPRASEGMENTALS = [
    // Stress
    { symbol: "ˈ", name: "primary stress" },
    { symbol: "ˌ", name: "secondary stress" },
    // Length
    { symbol: "ː", name: "long" },
    { symbol: "ˑ", name: "half-long" },
    { symbol: "̆", name: "extra-short", combining: true },
    // Tone marks
    { symbol: "̋", name: "extra high tone", combining: true },
    { symbol: "́", name: "high tone", combining: true },
    { symbol: "̄", name: "mid tone", combining: true },
    { symbol: "̀", name: "low tone", combining: true },
    { symbol: "̏", name: "extra low tone", combining: true },
    { symbol: "̌", name: "rising tone", combining: true },
    { symbol: "̂", name: "falling tone", combining: true },
    { symbol: "᷄", name: "high rising tone", combining: true },
    { symbol: "᷅", name: "low rising tone", combining: true },
    { symbol: "᷈", name: "rising-falling tone", combining: true },
    // Intonation
    { symbol: "|", name: "minor (foot) group" },
    { symbol: "‖", name: "major (intonation) group" },
    { symbol: "‿", name: "linking (absence of a break)" },
    // Other
    { symbol: ".", name: "syllable break" },
    { symbol: "↗", name: "global rise" },
    { symbol: "↘", name: "global fall" },
]

const IPA_CLICKS = [
    { symbol: "ʘ", name: "bilabial click" },
    { symbol: "ǀ", name: "dental click" },
    { symbol: "ǃ", name: "postalveolar click" },
    { symbol: "ǂ", name: "palatoalveolar click" },
    { symbol: "ǁ", name: "alveolar lateral click" },
    // Implosives
    { symbol: "ɓ", name: "voiced bilabial implosive" },
    { symbol: "ɗ", name: "voiced alveolar implosive" },
    { symbol: "ʄ", name: "voiced palatal implosive" },
    { symbol: "ɠ", name: "voiced velar implosive" },
    { symbol: "ʛ", name: "voiced uvular implosive" },
    // Ejectives (marked with ʼ)
    { symbol: "pʼ", name: "bilabial ejective" },
    { symbol: "tʼ", name: "alveolar ejective" },
    { symbol: "kʼ", name: "velar ejective" },
    { symbol: "sʼ", name: "alveolar fricative ejective" },
    // Other clicks
    { symbol: "ǃ˞", name: "retroflex click" },
]

interface IPAKeyboardProps {
    onSelect: (symbol: string) => void
    onDelete?: () => void
    onClose?: () => void
    currentValue?: string
}

export function IPAKeyboard({ onSelect, onDelete, onClose, currentValue = "" }: IPAKeyboardProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [activeTab, setActiveTab] = useState("consonants")
    const [isPlaying, setIsPlaying] = useState(false)

    // Combine all categories for search
    const allSymbols = useMemo(
        () => [
            ...IPA_CONSONANTS.map((s) => ({ ...s, category: "consonants" })),
            ...IPA_VOWELS.map((s) => ({ ...s, category: "vowels" })),
            ...IPA_DIACRITICS.map((s) => ({ ...s, category: "diacritics" })),
            ...IPA_SUPRASEGMENTALS.map((s) => ({ ...s, category: "suprasegmentals" })),
            ...IPA_CLICKS.map((s) => ({ ...s, category: "clicks" })),
        ],
        []
    )

    // Filter symbols based on search query
    const filteredSymbols = useMemo(() => {
        if (!searchQuery.trim()) return null

        const query = searchQuery.toLowerCase()
        return allSymbols.filter(
            (s) =>
                s.symbol.toLowerCase().includes(query) ||
                s.name.toLowerCase().includes(query)
        )
    }, [searchQuery, allSymbols])

    // Handle listen button click
    const handleListen = async () => {
        if (!currentValue || currentValue.trim().length === 0) {
            toast.error("No IPA text to play")
            return
        }

        setIsPlaying(true)

        try {
            const response = await fetch("/api/pronounce", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ ipa: currentValue }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to generate pronunciation")
            }

            if (data.audioUrl) {
                const audio = new Audio(data.audioUrl)
                audio.onended = () => setIsPlaying(false)
                audio.onerror = () => {
                    setIsPlaying(false)
                    toast.error("Error playing audio")
                }
                await audio.play()
            } else {
                throw new Error("No audio URL returned")
            }

            if (data.warning) {
                toast.warning(data.warning, {
                    description: "This IPA reader may not support some symbols.",
                })
            }
        } catch (err) {
            setIsPlaying(false)
            toast.error("Audio unavailable", {
                description: "Audio unavailable for this IPA pronunciation.",
            })
        }
    }

    const renderSymbolButton = (
        symbol: { symbol: string; name: string; combining?: boolean },
        index: number
    ) => {
        // For combining diacritics, show with a dotted circle placeholder
        const displaySymbol = symbol.combining ? `◌${symbol.symbol}` : symbol.symbol

        return (
            <TooltipProvider key={`${symbol.symbol}-${index}`} delayDuration={200}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                                "h-10 min-w-[40px] px-2 font-mono text-lg hover:bg-primary hover:text-primary-foreground transition-colors",
                                symbol.combining && "text-base"
                            )}
                            onClick={() => onSelect(symbol.symbol)}
                        >
                            {displaySymbol}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                        <p className="text-sm">{symbol.name}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }

    const renderSymbolGrid = (symbols: Array<{ symbol: string; name: string; combining?: boolean }>) => (
        <div className="flex flex-wrap gap-1.5 p-2">
            {symbols.map((s, i) => renderSymbolButton(s, i))}
        </div>
    )

    return (
        <div className="w-[400px] max-w-[95vw]">
            {/* Header with current value, backspace, and listen button */}
            {currentValue && (
                <div className="p-3 border-b flex items-center justify-between gap-2 bg-muted/30">
                    <div className="flex-1 font-mono text-lg truncate">
                        {currentValue}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <TooltipProvider delayDuration={200}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={onDelete}
                                        className="h-8 w-8"
                                    >
                                        <Delete className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Delete last character</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider delayDuration={200}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleListen}
                                        disabled={isPlaying}
                                    >
                                        {isPlaying ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Volume2 className="h-4 w-4" />
                                        )}
                                        <span className="ml-1.5">Listen</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Play IPA pronunciation</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            )}

            {/* Search bar */}
            <div className="p-3 border-b">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search symbols..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-9 h-9"
                    />
                    {searchQuery && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setSearchQuery("")}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Show search results or tabs */}
            {filteredSymbols ? (
                <div className="h-[280px] overflow-y-auto pr-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
                    {filteredSymbols.length > 0 ? (
                        renderSymbolGrid(filteredSymbols)
                    ) : (
                        <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                            No symbols found for &quot;{searchQuery}&quot;
                        </div>
                    )}
                </div>
            ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="w-full grid grid-cols-5 h-auto p-1">
                        <TabsTrigger value="consonants" className="text-xs px-2 py-1.5">
                            Consonants
                        </TabsTrigger>
                        <TabsTrigger value="vowels" className="text-xs px-2 py-1.5">
                            Vowels
                        </TabsTrigger>
                        <TabsTrigger value="diacritics" className="text-xs px-2 py-1.5">
                            Diacritics
                        </TabsTrigger>
                        <TabsTrigger value="supra" className="text-xs px-2 py-1.5">
                            Supra
                        </TabsTrigger>
                        <TabsTrigger value="clicks" className="text-xs px-2 py-1.5">
                            Clicks
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="consonants" className="m-0">
                        <div className="h-[280px] overflow-y-auto pr-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
                            {renderSymbolGrid(IPA_CONSONANTS)}
                        </div>
                    </TabsContent>
                    <TabsContent value="vowels" className="m-0">
                        <div className="h-[280px] overflow-y-auto pr-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
                            {renderSymbolGrid(IPA_VOWELS)}
                        </div>
                    </TabsContent>
                    <TabsContent value="diacritics" className="m-0">
                        <div className="h-[280px] overflow-y-auto pr-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
                            {renderSymbolGrid(IPA_DIACRITICS)}
                        </div>
                    </TabsContent>
                    <TabsContent value="supra" className="m-0">
                        <div className="h-[280px] overflow-y-auto pr-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
                            {renderSymbolGrid(IPA_SUPRASEGMENTALS)}
                        </div>
                    </TabsContent>
                    <TabsContent value="clicks" className="m-0">
                        <div className="h-[280px] overflow-y-auto pr-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
                            {renderSymbolGrid(IPA_CLICKS)}
                        </div>
                    </TabsContent>
                </Tabs>
            )}

            {/* Footer with hint */}
            <div className="p-2 border-t text-xs text-muted-foreground text-center">
                Click symbols to insert • Click outside to close
            </div>
        </div>
    )
}
