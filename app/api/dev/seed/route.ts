import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        console.log("Seeding Danskisk (Simplified Danish)...")

        // Ensure dev user exists
        const user = await prisma.user.upsert({
            where: { email: "dev@localhost" },
            update: {},
            create: {
                email: "dev@localhost",
                name: "Dev User",
            },
        })

        // Create or Update Danskisk
        const language = await prisma.language.upsert({
            where: { slug: "danskisk" },
            update: {},
            create: {
                name: "Danskisk",
                slug: "danskisk",
                description: "A simplified version of Danish designed for worldbuilding. It retains the core phonology of Danish while standardizing the orthography and simplifying the grammar.",
                visibility: "PUBLIC",
                ownerId: user.id,
                flagUrl: "/uploads/flag/danskisk.png", // Assuming user will upload or we use a placeholder
            },
        })

        // 1. Script & Alphabet
        const symbols = [
            { symbol: "a", ipa: "æ", name: "Open front unrounded vowel", order: 1 },
            { symbol: "b", ipa: "p", name: "Voiceless bilabial plosive", order: 2 },
            { symbol: "d", ipa: "t", name: "Voiceless alveolar plosive", order: 3 },
            { symbol: "e", ipa: "ɛ", name: "Open-mid front unrounded vowel", order: 4 },
            { symbol: "f", ipa: "f", name: "Voiceless labiodental fricative", order: 5 },
            { symbol: "g", ipa: "k", name: "Voiceless velar plosive", order: 6 },
            { symbol: "h", ipa: "h", name: "Voiceless glottal fricative", order: 7 },
            { symbol: "i", ipa: "i", name: "Close front unrounded vowel", order: 8 },
            { symbol: "j", ipa: "j", name: "Palatal approximant", order: 9 },
            { symbol: "k", ipa: "kʰ", name: "Aspirated voiceless velar plosive", order: 10 },
            { symbol: "l", ipa: "l", name: "Alveolar lateral approximant", order: 11 },
            { symbol: "m", ipa: "m", name: "Bilabial nasal", order: 12 },
            { symbol: "n", ipa: "n", name: "Alveolar nasal", order: 13 },
            { symbol: "o", ipa: "o", name: "Close-mid back rounded vowel", order: 14 },
            { symbol: "p", ipa: "pʰ", name: "Aspirated voiceless bilabial plosive", order: 15 },
            { symbol: "r", ipa: "ʁ", name: "Voiced uvular fricative", order: 16 },
            { symbol: "s", ipa: "s", name: "Voiceless alveolar fricative", order: 17 },
            { symbol: "t", ipa: "tʰ", name: "Aspirated voiceless alveolar plosive", order: 18 },
            { symbol: "u", ipa: "u", name: "Close back rounded vowel", order: 19 },
            { symbol: "v", ipa: "v", name: "Voiced labiodental fricative", order: 20 },
            { symbol: "æ", ipa: "ɛː", name: "Long open-mid front unrounded vowel", order: 21 },
            { symbol: "ø", ipa: "øː", name: "Long close-mid front rounded vowel", order: 22 },
            { symbol: "å", ipa: "ɔː", name: "Long open-mid back rounded vowel", order: 23 },
        ]

        await prisma.scriptSymbol.deleteMany({ where: { languageId: language.id } })
        await prisma.scriptSymbol.createMany({
            data: symbols.map(s => ({ ...s, languageId: language.id }))
        })

        // 2. Grammar Pages
        const grammarPages = [
            {
                title: "Introduction to Danskisk",
                slug: "intro",
                order: 1,
                content: {
                    type: "doc",
                    content: [
                        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Introduction to Danskisk" }] },
                        { type: "paragraph", content: [{ type: "text", text: "Danskisk is a simplified version of Danish. It removes the complex 'stød' and simplifies the vowel system while keeping the unique Scandinavian feel." }] },
                        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Core Philosophy" }] },
                        { type: "paragraph", content: [{ type: "text", text: "The main goal is regularity. Almost all nouns follow one of two patterns, and verbs have fixed endings for all persons." }] },
                    ]
                }
            },
            {
                title: "Nouns & Gender",
                slug: "nouns",
                order: 2,
                content: {
                    type: "doc",
                    content: [
                        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Nouns & Gender" }] },
                        { type: "paragraph", content: [{ type: "text", text: "Danskisk maintains the two Danish genders: Common (en) and Neuter (et)." }] },
                        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Definiteness" }] },
                        { type: "paragraph", content: [{ type: "text", text: "Definiteness is marked by suffixes: -en/n for common, and -et/t for neuter." }] },
                    ]
                }
            }
        ]

        await prisma.grammarPage.deleteMany({ where: { languageId: language.id } })
        for (const page of grammarPages) {
            await prisma.grammarPage.create({
                data: { ...page, languageId: language.id } as any
            })
        }

        // 3. Dictionary
        const dictionary = [
            { lemma: "en mand", gloss: "a man", ipa: "ɛn mæn", partOfSpeech: "noun" },
            { lemma: "en kvinde", gloss: "a woman", ipa: "ɛn kvinə", partOfSpeech: "noun" },
            { lemma: "et barn", gloss: "a child", ipa: "ɛt bɑːn", partOfSpeech: "noun" },
            { lemma: "at være", gloss: "to be", ipa: "æ vɛːrə", partOfSpeech: "verb" },
            { lemma: "at tale", gloss: "to speak", ipa: "æ tæːlə", partOfSpeech: "verb" },
            { lemma: "en by", gloss: "a city", ipa: "ɛn pyː", partOfSpeech: "noun" },
            { lemma: "et hus", gloss: "a house", ipa: "ɛt huːs", partOfSpeech: "noun" },
            { lemma: "rød", gloss: "red", ipa: "ʁøːð", partOfSpeech: "adjective" },
            { lemma: "blå", gloss: "blue", ipa: "blɔː", partOfSpeech: "adjective" },
            { lemma: "stor", gloss: "big", ipa: "stoːɐ", partOfSpeech: "adjective" },
        ]

        await prisma.dictionaryEntry.deleteMany({ where: { languageId: language.id } })
        await prisma.dictionaryEntry.createMany({
            data: dictionary.map(e => ({ ...e, languageId: language.id }))
        })

        // 4. Paradigms
        const rows = ["Indefinite", "Definite"]
        const columns = ["Singular", "Plural"]
        const cells = {
            "0-0": "mand",
            "0-1": "mænd",
            "1-0": "manden",
            "1-1": "mændene"
        }

        await prisma.paradigm.deleteMany({ where: { languageId: language.id } })
        await prisma.paradigm.create({
            data: {
                name: "Common Noun Declension",
                notes: "Standard pattern for common gender nouns (en-nouns).",
                languageId: language.id,
                slots: {
                    rows,
                    columns,
                    cells
                } as any
            }
        })

        return NextResponse.json({ success: true, message: "Danskisk seeded successfully!" })
    } catch (error) {
        console.error("Seed error:", error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
