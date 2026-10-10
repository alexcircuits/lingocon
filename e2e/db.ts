import { PrismaClient } from "@prisma/client"
import { E2E_USERS, type E2eRole } from "./data"
import { unique } from "./fixtures"

/**
 * Direct database access for test arrangement (a throwaway language per test, so
 * destructive flows such as renames and deletes never touch shared fixtures) and
 * for asserting what a flow persisted. Uses the same DATABASE_URL as the server.
 */
let client: PrismaClient | undefined

export function db(): PrismaClient {
  client ??= new PrismaClient()
  return client
}

export async function userId(role: E2eRole): Promise<string> {
  const user = await db().user.findUniqueOrThrow({ where: { email: E2E_USERS[role].email }, select: { id: true } })
  return user.id
}

export interface ScratchLanguage {
  id: string
  slug: string
  name: string
}

/** A fresh language owned by `role`, with a small alphabet and dictionary. */
export async function createScratchLanguage(
  role: E2eRole,
  options: { visibility?: "PUBLIC" | "PRIVATE" | "UNLISTED"; entries?: { lemma: string; gloss: string }[] } = {}
): Promise<ScratchLanguage> {
  const suffix = unique()
  const slug = `e2e-scratch-${suffix}`
  const name = `Scratch ${suffix}`
  const language = await db().language.create({
    data: {
      slug,
      name,
      visibility: options.visibility ?? "PRIVATE",
      ownerId: await userId(role),
      scriptSymbols: {
        create: ["a", "e", "i", "o", "u", "k", "l", "m", "n", "s", "t"].map((symbol, order) => ({ symbol, order })),
      },
      dictionaryEntries: {
        create: options.entries ?? [
          { lemma: "kala", gloss: "stone" },
          { lemma: "nemi", gloss: "name" },
        ],
      },
    },
    select: { id: true, slug: true, name: true },
  })
  return language
}

export async function disconnectDb(): Promise<void> {
  await client?.$disconnect()
  client = undefined
}
