import { z } from "zod"

export const createScriptSymbolSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").max(10),
  capitalSymbol: z.string().max(10).optional().nullable(),
  ipa: z.string().max(50).optional(),
  latin: z.string().max(10).optional(),
  name: z.string().max(200).optional(),
  order: z.number().int().default(0),
  languageId: z.string().min(1),
})

export const updateScriptSymbolSchema = z.object({
  id: z.string().min(1),
  symbol: z.string().min(1, "Symbol is required").max(10),
  capitalSymbol: z.string().max(10).optional().nullable(),
  ipa: z.string().max(50).optional(),
  latin: z.string().max(10).optional(),
  name: z.string().max(200).optional(),
  order: z.number().int(),
  languageId: z.string().min(1),
})

export type CreateScriptSymbolInput = z.infer<typeof createScriptSymbolSchema>
export type UpdateScriptSymbolInput = z.infer<typeof updateScriptSymbolSchema>

