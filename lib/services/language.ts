import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { canEditScope } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/admin"
import { UnauthorizedError, NotFoundError, ConflictError, ValidationError } from "@/lib/errors"
import {
  createLanguageSchema,
  updateLanguageSchema,
  languageMetadataSchema,
  type CreateLanguageInput,
  type UpdateLanguageInput,
} from "@/lib/validations/language"

// Keys the phonology editors own; everything else in metadata is a language setting.
const PHONOLOGY_METADATA_KEYS = new Set([
  "soundChangeRules",
  "phonologyOverride",
  "allophonyRules",
  "syllableStructure",
])
const MAX_METADATA_BYTES = 200_000

export async function createLanguage(input: CreateLanguageInput, userId: string) {
  const validated = createLanguageSchema.parse(input)

  const existing = await prisma.language.findUnique({
    where: { slug: validated.slug },
  })

  if (existing) {
    throw new ConflictError("A language with this slug already exists")
  }

  // Also check if someone else has reserved this slug
  const reserved = await prisma.slugReservation.findUnique({
    where: { slug: validated.slug },
  })
  if (reserved && reserved.reservedUntil > new Date()) {
    throw new ConflictError("This slug is temporarily reserved. Please try a different one.")
  }

  return prisma.language.create({
    data: {
      name: validated.name,
      slug: validated.slug,
      description: validated.description || null,
      visibility: validated.visibility,
      category: validated.category ?? "CONLANG",
      metadata: validated.metadata ? (validated.metadata as any) : null,
      ownerId: userId,
    },
  })
}

/**
 * Reserve the old slug and return the column changes for a slug change (none if unchanged).
 * Only the owner (or an admin) may rename: the URL is the project's identity, and the
 * settings form disables the field for collaborators, who still resend the current value.
 */
async function changeSlug(
  tx: Prisma.TransactionClient,
  languageId: string,
  newSlug: string,
  userId: string
): Promise<Record<string, unknown>> {
  // Need current slug to see if it actually changed
  const currentLang = await tx.language.findUnique({
    where: { id: languageId },
    select: { slug: true, ownerId: true },
  })
  if (!currentLang || currentLang.slug === newSlug) return {}
  if (currentLang.ownerId !== userId && !(await isAdmin())) throw new UnauthorizedError()

  // 1. Check if new slug is already taken by a language
  const existing = await tx.language.findUnique({ where: { slug: newSlug } })
  if (existing) throw new ConflictError("A language with this slug already exists")

  // 2. Check if new slug is reserved
  const reserved = await tx.slugReservation.findUnique({ where: { slug: newSlug } })
  if (reserved && reserved.reservedUntil > new Date()) {
    throw new ConflictError("This slug is temporarily reserved. Please try a different one.")
  }

  // 3. Clear any expired reservations for the old slug
  await tx.slugReservation.deleteMany({
    where: { slug: currentLang.slug, reservedUntil: { lte: new Date() } },
  })

  // 4. Reserve the old slug for 180 days
  const reservedUntil = new Date()
  reservedUntil.setDate(reservedUntil.getDate() + 180)
  await tx.slugReservation.upsert({
    where: { slug: currentLang.slug },
    update: { languageId, reservedUntil },
    create: { slug: currentLang.slug, languageId, reservedUntil },
  })

  return { slug: newSlug, lastSlugChangedAt: new Date() }
}

export async function updateLanguage(input: UpdateLanguageInput, userId: string) {
  const validated = updateLanguageSchema.parse(input)

  const canEdit = await canEditScope(validated.id, userId, "write:settings")
  if (!canEdit) {
    throw new UnauthorizedError()
  }
  // `metadata` is a top-level patch, never a whole-document replacement: keys the caller did not
  // send keep their current stored values. Keys owned by the phonology editors need that scope too.
  const metadataPatch: Record<string, unknown> = validated.metadata ?? {}
  if (
    Object.keys(metadataPatch).some((key) => PHONOLOGY_METADATA_KEYS.has(key)) &&
    !(await canEditScope(validated.id, userId, "write:phonology"))
  ) {
    throw new UnauthorizedError()
  }

  const updateData: Record<string, unknown> = {}
  if (validated.name !== undefined) updateData.name = validated.name
  if (validated.description !== undefined) updateData.description = validated.description || null
  if (validated.visibility !== undefined) updateData.visibility = validated.visibility
  if (validated.flagUrl !== undefined) updateData.flagUrl = validated.flagUrl || null
  if (validated.discordUrl !== undefined) updateData.discordUrl = validated.discordUrl || null
  if (validated.telegramUrl !== undefined) updateData.telegramUrl = validated.telegramUrl || null
  if (validated.websiteUrl !== undefined) updateData.websiteUrl = validated.websiteUrl || null
  if (validated.fontUrl !== undefined) updateData.fontUrl = validated.fontUrl || null
  if (validated.fontFamily !== undefined) updateData.fontFamily = validated.fontFamily || null
  if (validated.fontScale !== undefined) updateData.fontScale = validated.fontScale
  if (validated.allowsDiacritics !== undefined) updateData.allowsDiacritics = validated.allowsDiacritics
  if (validated.allowForking !== undefined) updateData.allowForking = validated.allowForking
  if (validated.acceptRomanizedAnswers !== undefined) updateData.acceptRomanizedAnswers = validated.acceptRomanizedAnswers
  if (validated.category !== undefined) updateData.category = validated.category

  // Slug reservation, columns and the metadata patch commit together: a rejected part rolls all back.
  return prisma.$transaction(async (tx) => {
    const slugChange = validated.slug !== undefined ? await changeSlug(tx, validated.id, validated.slug, userId) : {}
    await mergeLanguageMetadata(tx, validated.id, metadataPatch)
    const data = { ...updateData, ...slugChange }
    if (Object.keys(data).length === 0) {
      return tx.language.findUniqueOrThrow({ where: { id: validated.id } })
    }
    return tx.language.update({ where: { id: validated.id }, data })
  })
}

/** Deletes the language (owner only) and returns its slug so callers can refresh its routes. */
export async function deleteLanguage(languageId: string, userId: string): Promise<{ slug: string }> {
  if (process.env.DEV_MODE !== "true") {
    const language = await prisma.language.findUnique({
      where: { id: languageId },
      select: { ownerId: true },
    })

    if (!language || language.ownerId !== userId) {
      throw new UnauthorizedError()
    }
  }

  return prisma.language.delete({
    where: { id: languageId },
    select: { slug: true },
  })
}

/**
 * Merge a top-level metadata patch into the stored document in ONE statement (`jsonb || patch`),
 * so the merge happens on the row PostgreSQL locks for the UPDATE — never on a snapshot read
 * earlier. Editors that own different keys (settings `tts`, phonology, sound-change rules) can no
 * longer put back each other's older values, and concurrent saves of different keys all survive.
 *
 * Only what this save writes is validated: the patch against `languageMetadataSchema` (top-level
 * keys are independent, so a valid document stays valid) and the merged size. Legacy invalid keys
 * the patch does not touch are left alone instead of blocking every editor. Must run inside a
 * transaction: the size check throws to roll the UPDATE back. Returns null for an empty patch.
 */
async function mergeLanguageMetadata(
  tx: Prisma.TransactionClient,
  languageId: string,
  patch: Record<string, unknown>
): Promise<{ slug: string } | null> {
  const parsed = languageMetadataSchema.safeParse(patch)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : ""
    throw new ValidationError(issue ? `${where}${issue.message}` : "Invalid language metadata")
  }
  const json = JSON.stringify(parsed.data)
  if (json === "{}") return null

  const rows = await tx.$queryRaw<{ slug: string; size: number }[]>`
    UPDATE "languages"
    SET "metadata" = (
          CASE WHEN jsonb_typeof("metadata") = 'object' THEN "metadata" ELSE '{}'::jsonb END
        ) || ${json}::jsonb,
        "updatedAt" = NOW()
    WHERE "id" = ${languageId}
    RETURNING "slug", octet_length("metadata"::text)::int AS "size"`
  if (rows.length === 0) throw new NotFoundError("Language", languageId)
  if (rows[0].size > MAX_METADATA_BYTES) {
    throw new ValidationError("Language metadata is too large")
  }
  return { slug: rows[0].slug }
}

/** Save a metadata patch; the scope follows the keys (phonology keys need `write:phonology`). */
export async function updateLanguageMetadata(
  languageId: string,
  updates: Record<string, unknown>,
  userId: string
): Promise<{ slug: string }> {
  // Sound-change rules belong to the "Phonology & Sound Changes" scope, not just the owner:
  // collaborators with that permission could open the editor but every save was refused.
  // Every scope the patch touches is required: a mixed patch must not let a
  // settings-only collaborator write phonology keys (or the reverse).
  const keys = Object.keys(updates ?? {})
  const scopes = new Set<"write:phonology" | "write:settings">()
  for (const key of keys) scopes.add(PHONOLOGY_METADATA_KEYS.has(key) ? "write:phonology" : "write:settings")
  if (scopes.size === 0) scopes.add("write:settings")
  for (const scope of scopes) {
    if (!(await canEditScope(languageId, userId, scope))) {
      throw new UnauthorizedError()
    }
  }

  return prisma.$transaction(async (tx) => {
    const merged = await mergeLanguageMetadata(tx, languageId, updates ?? {})
    if (merged) return merged
    const language = await tx.language.findUnique({ where: { id: languageId }, select: { slug: true } })
    if (!language) throw new NotFoundError("Language", languageId)
    return language
  })
}
