// @vitest-environment node
/**
 * REAL-DATABASE test for the studio phonology page's data loading. Skipped unless DATABASE_URL
 * points at a disposable local `lingocon_rewrite_test_*` database; uses only its own rows.
 */
import { randomUUID } from "node:crypto"
import { createElement, type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const testDb = vi.hoisted(() => {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "")
    const ok = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      && /^\/lingocon_rewrite_test_\w+$/.test(url.pathname)
      && url.search === "" // ?host= etc. could point Prisma elsewhere
    if (ok) process.env.DEV_MODE = "false"
    return ok
  } catch {
    return false
  }
})
const actor = vi.hoisted(() => ({ id: null as string | null }))
vi.mock("@/auth", () => ({ auth: async () => (actor.id ? { user: { id: actor.id } } : null) }))
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`redirect:${url}`) },
  notFound: () => { throw new Error("notFound") },
}))
vi.mock("../phonology-view", () => ({ PhonologyView: function PhonologyView() { return null } }))

import { prisma } from "@/lib/prisma"
import { PhonemeFrequencyChart } from "@/components/phoneme-frequency-chart"
import PhonologyPage from "../page"
import { PhonologyView } from "../phonology-view"

const prefix = `phonology-page-${randomUUID().slice(0, 8)}`
const owner = `${prefix}-owner`
const stranger = `${prefix}-stranger`
const project = `${prefix}-project`

function findAll(node: ReactNode, found: ReactElement[] = []): ReactElement[] {
  const element = node as ReactElement<{ children?: ReactNode }>
  if (!element || typeof element !== "object") return found
  found.push(element)
  for (const child of ([] as ReactNode[]).concat(element.props?.children ?? [])) findAll(child, found)
  return found
}
const page = () => PhonologyPage({ params: Promise.resolve({ slug: project }) })

describe.skipIf(!testDb)("studio phonology page (real Postgres)", () => {
  beforeAll(async () => {
    await prisma.user.createMany({ data: [owner, stranger].map((id) => ({ id, email: `${id}@example.test` })) })
    await prisma.language.create({
      data: {
        id: project, slug: project, name: project, ownerId: owner,
        metadata: {
          syllableStructure: "CV", allophonyRules: "t > d", phonologyOverride: { enabled: false },
          soundChangeRules: "a > e", tts: { voiceId: "Hans" },
          // A legacy invalid field must not take the page down.
          vowels: null,
        },
      },
    })
    await prisma.scriptSymbol.createMany({
      data: [
        { languageId: project, symbol: "p", ipa: "p", order: 0 }, { languageId: project, symbol: "a", ipa: "a", order: 1 },
        { languageId: project, symbol: "ch", ipa: "tʃ", order: 2 }, { languageId: project, symbol: "x", ipa: null, order: 3 },
        { languageId: project, symbol: "i", ipa: "i", order: 4 }, { languageId: project, symbol: "t", ipa: "t", order: 5 },
      ],
    })
    // Distinct per-phoneme counts: the client chart ordered ties by (unordered) row order.
    const ipas = [...Array(30).fill("/ˈpaa/"), ...Array(12).fill("tʃii"), ...Array(5).fill("tata"), "", null, "pi", "ipi"]
    await prisma.dictionaryEntry.createMany({
      data: ipas.map((ipa, i) => ({ languageId: project, lemma: `w${i}`, gloss: `g${i}`, ipa })),
    })
  })
  afterAll(async () => {
    await prisma.language.deleteMany({ where: { id: project } })
    await prisma.user.deleteMany({ where: { id: { in: [owner, stranger] } } })
    await prisma.$disconnect()
  })

  it("passes the view only what it renders, and a bounded frequency summary instead of the IPA column", async () => {
    actor.id = owner
    const elements = findAll(await page())
    const view = elements.find((element) => element.type === PhonologyView)!
    expect(Object.keys(view.props as object).sort()).toEqual(["languageId", "metadata", "symbolIpas"])
    expect(view.props).toEqual({
      languageId: project,
      metadata: { syllableStructure: "CV", allophonyRules: "t > d", phonologyOverride: { enabled: false } },
      symbolIpas: ["p", "a", "tʃ", "i", "t"],
    })
    // No element receives the IPA column or dictionary entries.
    expect(elements.some((element) => "ipaList" in (element.props as object))).toBe(false)
    expect(JSON.stringify(elements.map((element) => element.props))).not.toContain("w0")

    // The summary card renders exactly what the client chart rendered from every transcription.
    const card = elements.find((element) => "summary" in (element.props as object))!
    const ipaList = (await prisma.dictionaryEntry.findMany({ where: { languageId: project }, select: { ipa: true } }))
      .map((entry) => entry.ipa)
    expect(renderToStaticMarkup(card)).toBe(renderToStaticMarkup(createElement(PhonemeFrequencyChart, {
      ipaList, knownPhonemes: ["p", "a", "tʃ", "i", "t"],
    })))
    expect(renderToStaticMarkup(card)).toContain("Distribution of phonemes across 49 transcribed dictionary entries")
  })

  it("does not render a private project for a user who cannot view it", async () => {
    actor.id = stranger
    await expect(page()).rejects.toThrow("notFound")
  })
})
