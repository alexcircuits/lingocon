import { z } from "zod"

export const createTextSchema = z.object({
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
      "Slug must be lowercase with hyphens only (e.g., my-book-title)"
    ),
  content: z.string().min(1, "Content is required"),
  coverImage: z.string().url().optional().nullable(),
  paradigmId: z.string().optional().nullable(),
  languageId: z.string().min(1, "Language is required"),
})

export const updateTextSchema = z.object({
  id: z.string().min(1, "Text ID is required"),
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
  content: z.string().min(1, "Content is required").optional(),
  coverImage: z.string().url().optional().nullable(),
  paradigmId: z.string().optional().nullable(),
})

export type CreateTextInput = z.infer<typeof createTextSchema>
export type UpdateTextInput = z.infer<typeof updateTextSchema>

