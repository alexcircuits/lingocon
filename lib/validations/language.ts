import { z } from "zod"
import { assetUrlSchema, optionalExternalLinkSchema } from "./url"

export const LANGUAGE_CATEGORIES = [
  "CONLANG",
  "NATURAL",
  "ENDANGERED",
  "RESTORED",
  "HISTORICAL",
  "FICTIONAL",
  "AUXILIARY",
  "OTHER",
] as const

export const languageCategorySchema = z.enum(LANGUAGE_CATEGORIES)
export type LanguageCategory = z.infer<typeof languageCategorySchema>

export const languageMetadataSchema = z.object({
  wordOrder: z.string().optional(),
  morphologicalTendency: z.string().optional(),
  vowels: z.array(z.string()).optional(),
  consonants: z.array(z.string()).optional(),
  syllableStructure: z.string().optional(),
  allophonyRules: z.string().optional(),
  soundChangeRules: z.string().optional(),
  phonologyOverride: z.object({
    enabled: z.boolean(),
    consonants: z.array(z.string()).optional(),
    vowels: z.array(z.string()).optional(),
  }).optional(),
}).catchall(z.any())

export type LanguageMetadata = z.infer<typeof languageMetadataSchema>

/** At most this many invalid top-level fields are dropped before giving up. */
const MAX_DROPPED_METADATA_FIELDS = 32

/**
 * Read stored metadata for display without ever throwing.
 *
 * Stored metadata is a free-form JSON column written by several generations of
 * the app. `languageMetadataSchema.parse()` throws on a single legacy value (an
 * explicit null, a string where a list is expected), and during rendering that
 * makes the whole page — the dictionary, the public alphabet — unavailable.
 * This keeps every valid field and drops only the top-level fields that fail
 * validation. Use the strict schema for validating writes.
 */
export function parseLanguageMetadata(raw: unknown): LanguageMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  let candidate: Record<string, unknown> = { ...(raw as Record<string, unknown>) }
  const dropped: string[] = []
  for (let attempt = 0; attempt <= MAX_DROPPED_METADATA_FIELDS; attempt++) {
    const result = languageMetadataSchema.safeParse(candidate)
    if (result.success) {
      if (dropped.length > 0) console.warn("Ignoring invalid language metadata fields", dropped)
      return result.data
    }
    const invalid = new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "")))
    invalid.delete("")
    if (invalid.size === 0) break
    candidate = Object.fromEntries(Object.entries(candidate).filter(([key]) => !invalid.has(key)))
    dropped.push(...invalid)
  }
  console.warn("Ignoring unreadable language metadata", dropped)
  return {}
}

export const createLanguageSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  description: z.string().max(1000).optional(),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]),
  category: languageCategorySchema.optional(),
  metadata: languageMetadataSchema.optional(), // Typology data from wizard
})

export const updateLanguageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Name is required").max(100).optional(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .optional(),
  description: z.string().max(1000).optional(),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).optional(),
  flagUrl: assetUrlSchema.optional().nullable().or(z.literal("")),
  discordUrl: optionalExternalLinkSchema,
  telegramUrl: optionalExternalLinkSchema,
  websiteUrl: optionalExternalLinkSchema,
  fontUrl: assetUrlSchema.optional().nullable().or(z.literal("")),
  fontFamily: z.string().max(100).optional().nullable(),
  fontScale: z.number().min(0.5).max(3.0).optional(),
  allowsDiacritics: z.boolean().optional(),
  allowForking: z.boolean().optional(),
  acceptRomanizedAnswers: z.boolean().optional(),
  category: languageCategorySchema.optional(),
  metadata: languageMetadataSchema.optional(),
})

export type CreateLanguageInput = z.infer<typeof createLanguageSchema>
export type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>
