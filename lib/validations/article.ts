import { z } from "zod"

export const createArticleSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100, "Slug must be less than 100 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase with hyphens only (e.g., my-article-title)"
    ),
  content: z.any(), // JSON content from TipTap editor
  paradigmId: z.string().optional().nullable(),
  languageId: z.string().min(1, "Language is required"),
})

export const updateArticleSchema = z.object({
  id: z.string().min(1, "Article ID is required"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .optional(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100, "Slug must be less than 100 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase with hyphens only"
    )
    .optional(),
  content: z.any().optional(),
  coverImage: z.string().url().optional().nullable().or(z.literal("")),
  paradigmId: z.string().optional().nullable(),
})

export type CreateArticleInput = z.infer<typeof createArticleSchema>
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>

