/**
 * Server-side data loader shared by the production module data route and the
 * developer playground. Maps a runtime method to a scoped, capped read of a
 * language's data. Permission/visibility checks live in the calling routes.
 */
import { prisma } from "@/lib/prisma"
import type { RuntimeMethod } from "@/lib/modules/runtime-protocol"
import {
  buildVowelChartData,
  extractVowelInventory,
} from "@/lib/utils/vowel-inventory"

export async function loadModuleData(method: RuntimeMethod, languageId: string) {
  switch (method) {
    case "getLanguage": {
      const language = await prisma.language.findUnique({
        where: { id: languageId },
        select: { name: true, slug: true, description: true },
      })
      return language ?? { name: "", slug: "", description: null }
    }

    case "getDictionary": {
      const entries = await prisma.dictionaryEntry.findMany({
        where: { languageId },
        select: { lemma: true, gloss: true, ipa: true, partOfSpeech: true, paradigmId: true },
        orderBy: { lemma: "asc" },
        take: 2000,
      })
      return { entries }
    }

    case "getPhonology": {
      const [language, symbols] = await Promise.all([
        prisma.language.findUnique({
          where: { id: languageId },
          select: { metadata: true },
        }),
        prisma.scriptSymbol.findMany({
          where: { languageId },
          select: { symbol: true, ipa: true, latin: true, name: true },
          orderBy: { order: "asc" },
          take: 1000,
        }),
      ])

      const vowels = extractVowelInventory(symbols, language?.metadata)
      const { points: vowelChart, unknown: unknownVowels } = buildVowelChartData(vowels)

      return { symbols, vowels, vowelChart, unknownVowels }
    }

    case "getParadigms": {
      const paradigms = await prisma.paradigm.findMany({
        where: { languageId },
        select: {
          id: true,
          name: true,
          slots: true,
          dictionaryEntries: { select: { lemma: true, gloss: true }, take: 500 },
        },
        orderBy: { name: "asc" },
        take: 200,
      })
      return {
        paradigms: paradigms.map((p) => ({
          id: p.id,
          name: p.name,
          slots: p.slots,
          words: p.dictionaryEntries,
        })),
      }
    }

    case "getGrammar": {
      const pages = await prisma.grammarPage.findMany({
        where: { languageId },
        select: { slug: true, title: true, order: true },
        orderBy: { order: "asc" },
        take: 200,
      })
      return { pages }
    }

    case "getTexts": {
      const texts = await prisma.text.findMany({
        where: { languageId, published: true },
        select: { slug: true, title: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
      return { texts }
    }

    default:
      return {}
  }
}
