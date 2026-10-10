/**
 * E2E fixtures: role accounts with real passwords (signed in through /login by
 * e2e/auth.setup.ts) and two languages with content in every section.
 *
 *   DATABASE_URL=postgresql://…/lingocon_e2e… npx tsx e2e/seed.ts
 *
 * Idempotent: users are upserted, the fixture languages are deleted (cascade) and
 * recreated, so every run starts from the same content. Refuses to run against
 * anything but a local test database — it sets known passwords.
 */
import { PrismaClient, type Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { E2E_LANGUAGES, E2E_PASSWORD, E2E_USERS, type E2eRole } from "./data"

function assertTestDatabase(databaseUrl: string | undefined): void {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set")
  const url = new URL(databaseUrl)
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  const name = url.pathname.slice(1)
  // CI's throwaway service container is called "lingocon"; anywhere else the name must say test.
  const testName = /(^|_)(test|e2e)(_|$)/i.test(name) || process.env.CI === "true"
  if (!local || !testName) {
    throw new Error(`Refusing to seed E2E accounts into ${url.hostname}/${name}: not a local test database`)
  }
}

assertTestDatabase(process.env.DATABASE_URL)
const prisma = new PrismaClient()

const doc = (...paragraphs: string[]): Prisma.InputJsonValue => ({
  type: "doc",
  content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
})

async function upsertUsers(): Promise<Record<E2eRole, string>> {
  const password = await bcrypt.hash(E2E_PASSWORD, 10)
  const ids = {} as Record<E2eRole, string>
  for (const [role, user] of Object.entries(E2E_USERS) as [E2eRole, (typeof E2E_USERS)[E2eRole]][]) {
    const data = {
      name: user.name,
      password,
      emailVerified: new Date("2026-01-01T00:00:00Z"),
      isAdmin: role === "admin",
      isSuspended: role === "suspended",
      suspendedAt: role === "suspended" ? new Date("2026-01-01T00:00:00Z") : null,
    }
    const row = await prisma.user.upsert({
      where: { email: user.email },
      update: data,
      create: { email: user.email, ...data },
      select: { id: true },
    })
    ids[role] = row.id
  }
  return ids
}

async function createLanguage(
  slug: string,
  name: string,
  visibility: "PUBLIC" | "PRIVATE",
  ownerId: string
) {
  const language = await prisma.language.create({
    data: {
      slug,
      name,
      visibility,
      ownerId,
      description: `${name} — E2E fixture language.`,
      metadata: { syllableStructure: "(C)V(C)", consonants: ["p", "t", "k", "s", "m", "n", "r", "l"], vowels: ["a", "e", "i", "o", "u"] },
    },
  })
  const languageId = language.id

  await prisma.scriptSymbol.createMany({
    data: ["a", "e", "i", "o", "u", "p", "t", "k", "s", "m", "n", "r", "l"].map((symbol, order) => ({
      symbol,
      capitalSymbol: symbol.toUpperCase(),
      ipa: symbol,
      order,
      languageId,
    })),
  })
  const paradigm = await prisma.paradigm.create({
    data: {
      name: "Present tense",
      slots: { rows: ["1sg", "2sg", "3sg"], columns: ["form"], cells: { "0-0": "-a", "1-0": "-e", "2-0": "-i" } },
      notes: "Regular verbs.",
      languageId,
    },
  })
  await prisma.dictionaryEntry.createMany({
    data: [
      { lemma: "tama", gloss: "water", ipa: "ˈtama", partOfSpeech: "noun", languageId },
      { lemma: "kelo", gloss: "fire", ipa: "ˈkelo", partOfSpeech: "noun", languageId },
      { lemma: "suna", gloss: "sun", ipa: "ˈsuna", partOfSpeech: "noun", languageId },
      { lemma: "miro", gloss: "to see", ipa: "ˈmiro", partOfSpeech: "verb", languageId, paradigmId: paradigm.id },
      { lemma: "pala", gloss: "hand", ipa: "ˈpala", partOfSpeech: "noun", languageId },
    ],
  })
  await prisma.grammarPage.createMany({
    data: [
      { title: "Introduction", slug: "introduction", order: 0, languageId, content: doc("This is the E2E grammar introduction.") },
      { title: "Nouns", slug: "nouns", order: 1, languageId, content: doc("Nouns do not inflect for case.") },
    ],
  })
  await prisma.article.create({
    data: {
      title: "Welcome to the fixture",
      slug: "welcome",
      excerpt: "A published fixture article.",
      content: doc("Published article body for E2E."),
      published: true,
      publishedAt: new Date("2026-01-02T00:00:00Z"),
      languageId,
      authorId: ownerId,
    },
  })
  await prisma.text.create({
    data: {
      title: "The River",
      slug: "the-river",
      description: "A published fixture text.",
      type: "SHORT_STORY",
      content: doc("Tama suna kelo."),
      published: true,
      languageId,
      authorId: ownerId,
    },
  })
  return languageId
}

async function main() {
  const ids = await upsertUsers()

  await prisma.language.deleteMany({ where: { slug: { in: Object.values(E2E_LANGUAGES) } } })
  await createLanguage(E2E_LANGUAGES.public, "E2E Public Tongue", "PUBLIC", ids.owner)
  const privateId = await createLanguage(E2E_LANGUAGES.private, "E2E Private Tongue", "PRIVATE", ids.owner)

  await prisma.languageCollaborator.createMany({
    data: [
      { languageId: privateId, userId: ids.editor, role: "EDITOR", permissions: [] },
      { languageId: privateId, userId: ids.viewer, role: "VIEWER", permissions: [] },
    ],
  })
  console.log(`E2E seed: ${Object.keys(ids).length} users, languages ${Object.values(E2E_LANGUAGES).join(", ")}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
