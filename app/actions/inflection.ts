"use server"

import { ZodError } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getUserId, canEditScope, canViewLanguage } from "@/lib/auth-helpers"
import { paradigmRuleSchema, type ParadigmRuleInput } from "@/lib/validations/paradigm"
import { previewParadigmForms } from "@/lib/services/inflection-service"
import { enqueueJob } from "@/lib/jobs/queue"

async function paradigmContext(paradigmId: string) {
  return prisma.paradigm.findUnique({
    where: { id: paradigmId },
    select: { languageId: true, language: { select: { slug: true } } },
  })
}

/** All auto-inflection rules for a paradigm — gated on language visibility. */
export async function getParadigmRules(paradigmId: string) {
  const userId = await getUserId()
  const ctx = await paradigmContext(paradigmId)
  if (!ctx) return { error: "Paradigm not found" }
  if (!(await canViewLanguage(ctx.languageId, userId))) return { error: "Not found" }

  const rules = await prisma.paradigmRule.findMany({
    where: { paradigmId },
    orderBy: { cellKey: "asc" },
  })
  return { success: true as const, data: rules }
}

/** Create or update the transform rule for one paradigm cell. */
export async function upsertParadigmRule(input: ParadigmRuleInput) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const v = paradigmRuleSchema.parse(input)
    const ctx = await paradigmContext(v.paradigmId)
    if (!ctx) return { error: "Paradigm not found" }
    if (!(await canEditScope(ctx.languageId, userId, "write:paradigms"))) {
      return { error: "Unauthorized - You don't have permission to edit this language" }
    }

    const rule = await prisma.paradigmRule.upsert({
      where: { paradigmId_cellKey: { paradigmId: v.paradigmId, cellKey: v.cellKey } },
      update: { prefix: v.prefix, suffix: v.suffix, soundChange: v.soundChange },
      create: {
        paradigmId: v.paradigmId,
        cellKey: v.cellKey,
        prefix: v.prefix,
        suffix: v.suffix,
        soundChange: v.soundChange,
      },
    })

    // Materialize forms for this paradigm's entries off the request path.
    await enqueueJob("inflection_regen", { paradigmId: v.paradigmId })
    revalidatePath(`/studio/lang/${ctx.language.slug}/paradigms`)
    return { success: true as const, data: rule }
  } catch (error) {
    if (error instanceof ZodError) return { error: error.issues[0]?.message ?? "Validation failed" }
    return { error: error instanceof Error ? error.message : "Failed to save rule" }
  }
}

/** Remove a cell's transform rule (the cell reverts to a hand-typed value). */
export async function deleteParadigmRule(paradigmId: string, cellKey: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  const ctx = await paradigmContext(paradigmId)
  if (!ctx) return { error: "Paradigm not found" }
  if (!(await canEditScope(ctx.languageId, userId, "write:paradigms"))) {
    return { error: "Unauthorized" }
  }

  await prisma.paradigmRule.deleteMany({ where: { paradigmId, cellKey } })
  await enqueueJob("inflection_regen", { paradigmId })
  revalidatePath(`/studio/lang/${ctx.language.slug}/paradigms`)
  return { success: true as const }
}

/** Live preview: conjugate an arbitrary stem through a paradigm's rules without
 *  persisting. Available to anyone who can view the language. */
export async function previewInflection(paradigmId: string, stem: string) {
  const userId = await getUserId()
  const ctx = await paradigmContext(paradigmId)
  if (!ctx) return { error: "Paradigm not found" }
  if (!(await canViewLanguage(ctx.languageId, userId))) return { error: "Not found" }

  const trimmed = stem.trim().slice(0, 100)
  if (!trimmed) return { success: true as const, data: [] }
  const forms = await previewParadigmForms(paradigmId, trimmed)
  return { success: true as const, data: forms }
}

/** An entry's currently-materialized inflected forms — gated on visibility. */
export async function getEntryInflections(entryId: string) {
  const userId = await getUserId()
  const entry = await prisma.dictionaryEntry.findUnique({
    where: { id: entryId },
    select: { languageId: true },
  })
  if (!entry) return { error: "Entry not found" }
  if (!(await canViewLanguage(entry.languageId, userId))) return { error: "Not found" }

  const forms = await prisma.inflectedForm.findMany({
    where: { entryId },
    orderBy: { cellKey: "asc" },
    select: { cellKey: true, form: true },
  })
  return { success: true as const, data: forms }
}
