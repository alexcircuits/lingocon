import { z } from "zod"

export const createDictionaryEntrySchema = z.object({
  lemma: z.string().min(1, "Lemma is required").max(200),
  gloss: z.string().min(1, "Gloss is required").max(500),
  ipa: z.string().max(100).optional().nullable(),
  partOfSpeech: z.string().max(50).optional().nullable(),
  etymology: z.string().max(1000).optional().nullable(),
  relatedWords: z.array(z.string()).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional().nullable(),
  languageId: z.string().min(1),
})

export const updateDictionaryEntrySchema = z.object({
  id: z.string().min(1),
  lemma: z.string().min(1, "Lemma is required").max(200).optional(),
  gloss: z.string().min(1, "Gloss is required").max(500).optional(),
  ipa: z.string().max(100).optional().nullable(),
  partOfSpeech: z.string().max(50).optional().nullable(),
  etymology: z.string().max(1000).optional().nullable(),
  relatedWords: z.array(z.string()).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional().nullable(),
  languageId: z.string().min(1),
})

export const bulkUpdateDictionaryEntrySchema = z.object({
  entryIds: z.array(z.string()).min(1, "At least one entry must be selected"),
  updates: z.object({
    partOfSpeech: z.string().max(50).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  }),
  languageId: z.string().min(1),
})

export type CreateDictionaryEntryInput = z.infer<typeof createDictionaryEntrySchema>
export type UpdateDictionaryEntryInput = z.infer<typeof updateDictionaryEntrySchema>

