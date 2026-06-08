import { z } from "zod"

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
  flagUrl: z.string().optional().nullable(),
  discordUrl: z.string().url().optional().nullable().or(z.literal("")),
  telegramUrl: z.string().url().optional().nullable().or(z.literal("")),
  websiteUrl: z.string().optional().nullable(),
  fontUrl: z.string().optional().nullable(),
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
