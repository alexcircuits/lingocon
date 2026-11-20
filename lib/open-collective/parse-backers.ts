/**
 * Turns an Open Collective `account.members` GraphQL response into the list of
 * backers the site credits.
 *
 * The response is third-party input: the envelope is validated, every member is
 * validated on its own (a malformed one is skipped, not fatal), and only the
 * fields named here ever leave this module. Pure — no I/O, no mutation.
 */
import { z } from "zod"
import { OPEN_COLLECTIVE_IMAGE_HOST, OPEN_COLLECTIVE_ORIGIN } from "./constants"

export type BackerKind = "individual" | "organization"

export interface Backer {
  /** Display name; `null` for a contributor who must stay anonymous. */
  readonly name: string | null
  readonly kind: BackerKind
  /** Their Open Collective profile; `null` when anonymous. */
  readonly profileUrl: string | null
  /** Avatar on Open Collective's image host; `null` when anonymous or unusable. */
  readonly imageUrl: string | null
  /** Total contributed, in cents of the collective's currency. */
  readonly totalCents: number
}

export interface TopBackers {
  /** ISO 4217 code of the collective's currency; every total is in it. */
  readonly currency: string
  /** Largest total first. */
  readonly backers: readonly Backer[]
  /** Members the API returned that could not be used (malformed, wrong currency…). */
  readonly skipped: number
}

/** The response did not have the shape of an `account.members` result. */
export class OpenCollectiveResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OpenCollectiveResponseError"
  }
}

const MAX_NAME_LENGTH = 80
const INCOGNITO_SLUG = /^incognito-/i
// Control, zero-width and bidi-control characters: none belong in a name. Written as
// escapes on purpose: the characters themselves are invisible in an editor.
const UNSAFE_NAME_CHARS = /[\u0000-\u001F\u007F-\u009F\u061C\u180E\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g

const currencyCode = z.string().regex(/^[A-Z]{3}$/)

const envelopeSchema = z.object({
  data: z.object({
    account: z.object({
      currency: currencyCode,
      members: z.object({ nodes: z.array(z.unknown()) }),
    }),
  }),
})

const memberSchema = z.object({
  role: z.literal("BACKER"),
  totalDonations: z.object({
    valueInCents: z.number().finite().positive(),
    currency: currencyCode,
  }),
  account: z.object({
    id: z.string().min(1),
    slug: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/),
    name: z.string().nullish(),
    type: z.string(),
    imageUrl: z.string().nullish(),
    isIncognito: z.boolean().nullish(),
  }),
})

type Member = z.infer<typeof memberSchema>

interface RankedBacker {
  readonly accountId: string
  readonly backer: Backer
}

function cleanName(raw: string | null | undefined): string | null {
  if (!raw) return null
  // Line breaks and tabs separate words; the invisible characters are simply dropped.
  const collapsed = raw.replace(/\s+/g, " ").replace(UNSAFE_NAME_CHARS, "").replace(/ {2,}/g, " ").trim()
  if (!collapsed) return null
  return Array.from(collapsed).slice(0, MAX_NAME_LENGTH).join("")
}

function safeImageUrl(raw: string | null | undefined): string | null {
  if (!raw || !URL.canParse(raw)) return null
  const url = new URL(raw)
  const isPlainImageHostUrl =
    url.protocol === "https:" &&
    url.hostname === OPEN_COLLECTIVE_IMAGE_HOST &&
    url.port === "" &&
    url.username === "" &&
    url.password === ""
  return isPlainImageHostUrl ? url.href : null
}

function toBacker({ account, totalDonations }: Member): Backer {
  const name = cleanName(account.name)
  // Anonymous unless the API positively says otherwise: a missing flag must
  // never turn into a published name.
  const isAnonymous = account.isIncognito !== false || INCOGNITO_SLUG.test(account.slug) || name === null
  const identity = isAnonymous
    ? { name: null, profileUrl: null, imageUrl: null }
    : {
        name,
        profileUrl: `${OPEN_COLLECTIVE_ORIGIN}/${encodeURIComponent(account.slug)}`,
        imageUrl: safeImageUrl(account.imageUrl),
      }

  return {
    ...identity,
    kind: account.type === "INDIVIDUAL" ? "individual" : "organization",
    totalCents: Math.round(totalDonations.valueInCents),
  }
}

/** One entry per account: the same backer appears once per tier membership. */
function uniqueByAccount(ranked: readonly RankedBacker[]): readonly RankedBacker[] {
  const best = new Map<string, RankedBacker>()
  for (const entry of ranked) {
    const seen = best.get(entry.accountId)
    if (!seen || entry.backer.totalCents > seen.backer.totalCents) best.set(entry.accountId, entry)
  }
  // Map preserves first-insertion order, so equal totals keep the API's order.
  return [...best.values()]
}

/**
 * @param payload Parsed JSON body of the GraphQL response.
 * @param limit Maximum number of backers to return.
 * @throws {OpenCollectiveResponseError} when the envelope is not what was asked for.
 */
export function parseTopBackers(payload: unknown, limit: number): TopBackers {
  const envelope = envelopeSchema.safeParse(payload)
  if (!envelope.success) {
    const where = envelope.error.issues[0]?.path.join(".") || "(root)"
    throw new OpenCollectiveResponseError(`Unexpected Open Collective response shape at ${where}`)
  }

  const { currency, members } = envelope.data.data.account
  const ranked = members.nodes.flatMap((node): RankedBacker[] => {
    const member = memberSchema.safeParse(node)
    // Totals in another currency cannot be ranked against the rest.
    if (!member.success || member.data.totalDonations.currency !== currency) return []
    return [{ accountId: member.data.account.id, backer: toBacker(member.data) }]
  })

  const backers = uniqueByAccount(ranked)
    .map((entry) => entry.backer)
    .toSorted((a, b) => b.totalCents - a.totalCents)
    .slice(0, Math.max(0, limit))

  return { currency, backers, skipped: members.nodes.length - ranked.length }
}
