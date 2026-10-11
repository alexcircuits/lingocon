// @vitest-environment node
/**
 * REAL-DATABASE test: language metadata editors merge only the keys they send, atomically.
 *
 * Skipped unless DATABASE_URL points at a disposable local `lingocon_rewrite_test_*` database
 * (migrations applied). Creates and deletes only its own uniquely-prefixed rows.
 *
 *   DATABASE_URL=postgresql://…@localhost:5432/lingocon_rewrite_test_… npx vitest run language-metadata-merge
 */
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const testDb = vi.hoisted(() => {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "")
    const ok = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      && /^\/lingocon_rewrite_test_\w+$/.test(url.pathname)
      && url.search === "" // ?host= etc. could point Prisma elsewhere
    // Exercise production authorization regardless of the caller's shell.
    if (ok) process.env.DEV_MODE = "false"
    return ok
  } catch {
    return false
  }
})
const actor = vi.hoisted(() => ({ id: null as string | null }))
vi.mock("@/auth", () => ({ auth: async () => (actor.id ? { user: { id: actor.id } } : null) }))

import { prisma } from "@/lib/prisma"
import { UnauthorizedError } from "@/lib/errors"
import { updateLanguage, updateLanguageMetadata } from "../language"

const prefix = `metadata-merge-${randomUUID().slice(0, 8)}`
const owner = `${prefix}-owner`
const phonologist = `${prefix}-phonologist`
const settingsEditor = `${prefix}-settings`
const project = `${prefix}-project`
const metadata = async () => (await prisma.language.findUniqueOrThrow({ where: { id: project } })).metadata

const initial = { soundChangeRules: "a > e", wordOrder: "SOV", tts: { voiceId: "Joanna", speed: "slow" }, syllableStructure: "CV" }

describe.skipIf(!testDb)("language metadata editors merge only the keys they own (real Postgres)", () => {
  beforeAll(async () => {
    actor.id = owner
    await prisma.user.createMany({
      data: [owner, phonologist, settingsEditor].map((id) => ({ id, email: `${id}@example.test` })),
    })
    await prisma.language.create({ data: { id: project, slug: project, name: project, ownerId: owner } })
    await prisma.languageCollaborator.createMany({
      data: [
        { languageId: project, userId: phonologist, role: "EDITOR", permissions: ["write:phonology"] },
        { languageId: project, userId: settingsEditor, role: "EDITOR", permissions: ["write:settings"] },
      ],
    })
  })
  beforeEach(async () => {
    actor.id = owner
    await prisma.language.update({ where: { id: project }, data: { name: project, metadata: initial } })
  })
  afterAll(async () => {
    await prisma.language.deleteMany({ where: { id: project } })
    await prisma.user.deleteMany({ where: { id: { in: [owner, phonologist, settingsEditor] } } })
    await prisma.$disconnect()
  })

  it("a stale settings save does not put back sound-change rules saved after its snapshot", async () => {
    // Another tab saves newer rules after the settings tab loaded; settings then saves only `tts`.
    await updateLanguageMetadata(project, { soundChangeRules: "a > o" }, owner)
    const updated = await updateLanguage(
      { id: project, name: "Renamed", metadata: { tts: { voiceId: "Hans", speed: "110%" } } },
      owner
    )
    expect(updated.name).toBe("Renamed")
    expect(await metadata()).toEqual({ ...initial, soundChangeRules: "a > o", tts: { voiceId: "Hans", speed: "110%" } })
  })

  it("keeps every one of many concurrent saves of different keys", async () => {
    const keys = Array.from({ length: 12 }, (_, i) => `concurrent${i}`)
    await Promise.all([
      ...keys.map((key) => updateLanguageMetadata(project, { [key]: key }, owner)),
      updateLanguage({ id: project, metadata: { tts: { voiceId: "Amy", speed: "90%" } } }, settingsEditor),
      updateLanguageMetadata(project, { allophonyRules: "s > z / V_V" }, phonologist),
    ])
    expect(await metadata()).toEqual({
      ...initial,
      ...Object.fromEntries(keys.map((key) => [key, key])),
      tts: { voiceId: "Amy", speed: "90%" },
      allophonyRules: "s > z / V_V",
    })
  })

  it("lets a write:phonology collaborator save the phonology editor's keys", async () => {
    await updateLanguageMetadata(project, {
      syllableStructure: "CVC",
      allophonyRules: "t > d / V_V",
      phonologyOverride: { enabled: true, consonants: ["t"], vowels: ["a"] },
    }, phonologist)
    expect(await metadata()).toEqual({
      ...initial,
      syllableStructure: "CVC",
      allophonyRules: "t > d / V_V",
      phonologyOverride: { enabled: true, consonants: ["t"], vowels: ["a"] },
    })
  })

  it("refuses phonology keys to a settings-only collaborator on either path", async () => {
    await expect(updateLanguageMetadata(project, { syllableStructure: "V" }, settingsEditor)).rejects.toThrow(UnauthorizedError)
    await expect(
      updateLanguage({ id: project, name: "Not saved", metadata: { soundChangeRules: "x > y" } }, settingsEditor)
    ).rejects.toThrow(UnauthorizedError)
    const saved = await prisma.language.findUniqueOrThrow({ where: { id: project } })
    expect(saved.name).toBe(project)
    expect(saved.metadata).toEqual(initial)
  })

  it("lets only the owner change the slug; a settings collaborator may resend the current one", async () => {
    // The settings form disables the slug field for collaborators; a forged request must not rename.
    await expect(updateLanguage({ id: project, slug: `${project}-moved` }, settingsEditor)).rejects.toThrow(UnauthorizedError)
    const unchanged = await prisma.language.findUniqueOrThrow({ where: { id: project } })
    expect(unchanged.slug).toBe(project)
    expect(await prisma.slugReservation.count({ where: { languageId: project } })).toBe(0)
    // The form sends the unchanged slug with every save; that stays allowed.
    await expect(updateLanguage({ id: project, slug: project, name: "Renamed by editor" }, settingsEditor)).resolves.toMatchObject({
      slug: project,
      name: "Renamed by editor",
    })
  })

  it("lets only the owner change visibility; a settings collaborator may resend the current one", async () => {
    // Publishing the owner's work (or hiding it) is the owner's call, like the slug.
    await expect(updateLanguage({ id: project, visibility: "PUBLIC" }, settingsEditor)).rejects.toThrow(UnauthorizedError)
    expect((await prisma.language.findUniqueOrThrow({ where: { id: project } })).visibility).toBe("PRIVATE")
    // The settings form sends the unchanged visibility with every save; that stays allowed.
    await expect(updateLanguage({ id: project, visibility: "PRIVATE", name: "Edited by editor" }, settingsEditor)).resolves.toMatchObject({
      visibility: "PRIVATE",
      name: "Edited by editor",
    })
    await expect(updateLanguage({ id: project, visibility: "UNLISTED" }, owner)).resolves.toMatchObject({ visibility: "UNLISTED" })
    await prisma.language.update({ where: { id: project }, data: { visibility: "PRIVATE" } })
  })

  it("requires every scope a mixed patch touches (settings + phonology keys)", async () => {
    // A settings-only collaborator must not smuggle phonology keys in with a settings key…
    await expect(
      updateLanguageMetadata(project, { tts: { voiceId: "Hans", speed: "1" }, soundChangeRules: "x > y" }, settingsEditor)
    ).rejects.toThrow(UnauthorizedError)
    // …and a phonology-only collaborator must not smuggle settings keys in with phonology keys.
    await expect(
      updateLanguageMetadata(project, { syllableStructure: "CVC", tts: { voiceId: "Hans", speed: "1" } }, phonologist)
    ).rejects.toThrow(UnauthorizedError)
    expect(await metadata()).toEqual(initial)
  })

  it("rejects an invalid metadata value without writing any part of the save", async () => {
    await expect(
      updateLanguage({ id: project, name: "Not saved", metadata: { vowels: "not-a-list" } as never }, owner)
    ).rejects.toThrow()
    await expect(updateLanguageMetadata(project, { phonologyOverride: { enabled: "yes" } }, owner)).rejects.toThrow()
    const saved = await prisma.language.findUniqueOrThrow({ where: { id: project } })
    expect(saved.name).toBe(project)
    expect(saved.metadata).toEqual(initial)
  })

  it("rejects a save that would make the metadata too large and leaves the row unchanged", async () => {
    await expect(
      updateLanguage({ id: project, name: "Not saved", metadata: { notes: "x".repeat(250_000) } }, owner)
    ).rejects.toThrow(/too large/)
    const saved = await prisma.language.findUniqueOrThrow({ where: { id: project } })
    expect(saved.name).toBe(project)
    expect(saved.metadata).toEqual(initial)
  })

  it("keeps saving other keys when an untouched legacy field is invalid", async () => {
    await prisma.language.update({ where: { id: project }, data: { metadata: { vowels: null, soundChangeRules: "a > e" } } })
    await updateLanguage({ id: project, metadata: { tts: { voiceId: "Amy", speed: "slow" } } }, owner)
    await updateLanguageMetadata(project, { soundChangeRules: "a > o" }, owner)
    expect(await metadata()).toEqual({ vowels: null, soundChangeRules: "a > o", tts: { voiceId: "Amy", speed: "slow" } })
  })

  it("starts from an empty document when the stored metadata is null", async () => {
    await prisma.language.update({ where: { id: project }, data: { metadata: undefined } })
    await prisma.$executeRaw`UPDATE "languages" SET "metadata" = NULL WHERE "id" = ${project}`
    await updateLanguageMetadata(project, { soundChangeRules: "a > o" }, owner)
    expect(await metadata()).toEqual({ soundChangeRules: "a > o" })
  })
})
