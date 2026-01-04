import { z } from "zod"

export const toggleFavoriteSchema = z.object({
  languageId: z.string().min(1),
})

export type ToggleFavoriteInput = z.infer<typeof toggleFavoriteSchema>

