// @vitest-environment node
/**
 * REAL-DATABASE test: applying sound changes applies exactly what the editor previewed.
 * Skipped unless DATABASE_URL points at a disposable local `lingocon_rewrite_test_*` database;
 * uses only its own rows.
 */
import { randomUUID } from "node:crypto"
import type { ReactElement, ReactNode } from "react"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

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
vi.mock("../sound-change-editor", () => ({ SoundChangeEditor: function SoundChangeEditor() { return null } }))

import { prisma } from "@/lib/prisma"
import { applyPipeline, parseProgram } from "@/lib/utils/sound-change"
import { applySoundChangesToDictionary } from "@/app/actions/apply-sound-changes"
import SoundChangesPage from "../page"
import { SoundChangeEditor } from "../sound-change-editor"
import { inventorySets } from "../sound-change-inputs"

const prefix = `sound-apply-${randomUUID().slice(0, 8)}`
const owner = `${prefix}-owner`
const project = `${prefix}-project`

type EditorProps = Parameters<typeof SoundChangeEditor>[0]
function findEditorProps(node: ReactNode): EditorProps | null {
  const element = node as ReactElement<{ children?: ReactNode }>
  if (!element || typeof element !== "object") return null
  if (element.type === SoundChangeEditor) return element.props as unknown as EditorProps
  for (const child of ([] as ReactNode[]).concat(element.props?.children ?? [])) {
    const found = findEditorProps(child)
    if (found) return found
  }
  return null
}
async function editorProps(): Promise<EditorProps> {
  const props = findEditorProps(await SoundChangesPage({ params: Promise.resolve({ slug: project }) }))
  if (!props) throw new Error("SoundChangeEditor not rendered")
  return props
}
/** What the editor previews: its engine's JS path with the classes from its props. */
function preview(words: string[], props: EditorProps) {
  const { vowels, consonants } = inventorySets(props.phonology)
  const { classes, rules } = parseProgram(props.savedRules)
  return words.map((word) => applyPipeline(word, rules, vowels, consonants, classes).changed)
}
const lemmas = async () =>
  (await prisma.dictionaryEntry.findMany({ where: { languageId: project }, orderBy: { gloss: "asc" } })).map((e) => e.lemma)
const setMetadata = (metadata: object) => prisma.language.update({ where: { id: project }, data: { metadata } })

describe.skipIf(!testDb)("sound-change application applies exactly what was reviewed (real Postgres)", () => {
  beforeAll(async () => {
    actor.id = owner
    await prisma.user.create({ data: { id: owner, email: `${owner}@example.test` } })
    await prisma.language.create({ data: { id: project, slug: project, name: project, ownerId: owner } })
  })
  beforeEach(async () => {
    actor.id = owner
    await prisma.dictionaryEntry.deleteMany({ where: { languageId: project } })
    await prisma.dictionaryEntry.createMany({
      data: [
        { languageId: project, lemma: "pa", gloss: "1" },
        { languageId: project, lemma: "ta", gloss: "2", relatedWords: ["pa"] },
      ],
    })
  })
  afterAll(async () => {
    await prisma.language.deleteMany({ where: { id: project } })
    await prisma.user.deleteMany({ where: { id: owner } })
    await prisma.$disconnect()
  })

  it("previews with the same phonology override the server applies", async () => {
    // With the override only t is a consonant, so "pa" must stay unchanged.
    await setMetadata({
      soundChangeRules: "a → e / C_",
      phonologyOverride: { enabled: true, consonants: ["t"], vowels: ["a", "e"] },
    })
    const props = await editorProps()
    const shown = preview(["pa", "ta"], props)
    expect(shown).toEqual(["pa", "te"])

    const result = await applySoundChangesToDictionary(project, {
      rules: props.savedRules, vowels: props.phonology.vowels, consonants: props.phonology.consonants,
    })
    expect(result).toMatchObject({ success: true, data: { applied: 1, unchanged: 1 } })
    expect(await lemmas()).toEqual(shown)
  })

  it("rejects rules other than the reviewed ones with a typed conflict and changes nothing", async () => {
    await setMetadata({ soundChangeRules: "a → o" })
    const result = await applySoundChangesToDictionary(project, { rules: "a → e", vowels: null, consonants: null })
    expect(result).toMatchObject({ code: "RULES_CHANGED" })
    expect("error" in result && result.error).toBeTruthy()
    expect(await lemmas()).toEqual(["pa", "ta"])
  })

  it("rejects a reviewed phonology that no longer matches the saved override", async () => {
    await setMetadata({ soundChangeRules: "a → e / C_", phonologyOverride: { enabled: true, consonants: ["t"], vowels: ["a"] } })
    const result = await applySoundChangesToDictionary(project, { rules: "a → e / C_", vowels: null, consonants: null })
    expect(result).toMatchObject({ code: "RULES_CHANGED" })
    expect(await lemmas()).toEqual(["pa", "ta"])
  })

  it("rejects a request without the reviewed inputs", async () => {
    await setMetadata({ soundChangeRules: "a → e" })
    const result = await applySoundChangesToDictionary(project, undefined as never)
    expect("error" in result && result.error).toBeTruthy()
    expect(await lemmas()).toEqual(["pa", "ta"])
  })

  it("applies when the reviewed rules and phonology match, keeping related words in sync", async () => {
    await setMetadata({ soundChangeRules: "a → e" })
    const result = await applySoundChangesToDictionary(project, { rules: "a → e", vowels: null, consonants: null })
    expect(result).toMatchObject({ success: true, data: { applied: 2, unchanged: 0 } })
    expect(await lemmas()).toEqual(["pe", "te"])
    const te = await prisma.dictionaryEntry.findFirstOrThrow({ where: { languageId: project, lemma: "te" } })
    expect(te.relatedWords).toEqual(["pe"])
  })

  it("refuses a user without the dictionary scope", async () => {
    await setMetadata({ soundChangeRules: "a → e" })
    actor.id = null
    const result = await applySoundChangesToDictionary(project, { rules: "a → e", vowels: null, consonants: null })
    expect(result).toMatchObject({ error: "Unauthorized" })
    expect(await lemmas()).toEqual(["pa", "ta"])
  })
})
