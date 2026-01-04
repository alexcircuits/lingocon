import { z } from "zod"

export const createGrammarPageSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  content: z.any(), // JSON content from TipTap
  imageUrl: z.string().url().optional().nullable(),
  order: z.number().int().default(0),
  paradigmId: z.string().optional().nullable(),
  languageId: z.string().min(1),
})

export const updateGrammarPageSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, "Title is required").max(200).optional(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .optional(),
  content: z.any().optional(), // JSON content from TipTap
  imageUrl: z.string().url().optional().nullable(),
  order: z.number().int().optional(),
  paradigmId: z.string().optional().nullable(),
  languageId: z.string().min(1),
})

export type CreateGrammarPageInput = z.infer<typeof createGrammarPageSchema>
export type UpdateGrammarPageInput = z.infer<typeof updateGrammarPageSchema>

