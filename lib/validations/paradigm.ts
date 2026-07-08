import { z } from "zod"

export const paradigmSlotsSchema = z.object({
  rows: z.array(z.string()).default([]),
  columns: z.array(z.string()).default([]),
  cells: z.record(z.string(), z.string()).default({}),
})

export type ParadigmSlots = z.infer<typeof paradigmSlotsSchema>

export function parseParadigmSlots(slots: unknown): ParadigmSlots {
  const result = paradigmSlotsSchema.safeParse(slots)
  return result.success ? result.data : { rows: [], columns: [], cells: {} }
}

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
  notes: z.string().max(2000).optional().nullable(),
  languageId: z.string().min(1),
})

export type CreateParadigmInput = z.infer<typeof createParadigmSchema>
export type UpdateParadigmInput = z.infer<typeof updateParadigmSchema>

// A per-cell auto-inflection transform: affixes + an optional sound-change
// snippet applied to the stem. cellKey matches slots.cells keys ("rowIdx-colIdx").
export const paradigmRuleSchema = z.object({
  paradigmId: z.string().min(1),
  cellKey: z.string().min(1).max(50),
  prefix: z.string().max(100).default(""),
  suffix: z.string().max(100).default(""),
  soundChange: z.string().max(4000).default(""),
})

export type ParadigmRuleInput = z.infer<typeof paradigmRuleSchema>

