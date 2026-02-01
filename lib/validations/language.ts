import { z } from "zod"

export const createLanguageSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  description: z.string().max(1000).optional(),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]),
  metadata: z.record(z.string(), z.any()).optional(), // Typology data from wizard
})

export const updateLanguageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Name is required").max(100).optional(),
  description: z.string().max(1000).optional(),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).optional(),
  flagUrl: z.string().optional().nullable(),
  discordUrl: z.string().url().optional().nullable().or(z.literal("")),
  telegramUrl: z.string().url().optional().nullable().or(z.literal("")),
  websiteUrl: z.string().url().optional().nullable().or(z.literal("")),
  fontUrl: z.string().optional().nullable(),
  fontFamily: z.string().max(100).optional().nullable(),
  fontScale: z.number().min(0.5).max(3.0).optional(),
  allowsDiacritics: z.boolean().optional(),
})

export type CreateLanguageInput = z.infer<typeof createLanguageSchema>
export type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>
