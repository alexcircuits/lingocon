import { z } from "zod"

export const createParadigmSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  slots: z.record(z.string(), z.any()), // JSON structure for table
  notes: z.string().max(2000).optional(),
  languageId: z.string().min(1),
})

export const updateParadigmSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Name is required").max(200).optional(),
  slots: z.record(z.string(), z.any()).optional(),
  notes: z.string().max(2000).optional(),
  languageId: z.string().min(1),
})

export type CreateParadigmInput = z.infer<typeof createParadigmSchema>
export type UpdateParadigmInput = z.infer<typeof updateParadigmSchema>

