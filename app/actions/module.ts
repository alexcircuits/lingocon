"use server"

import { prisma } from "@/lib/prisma"
import { getUserId, canEditScope } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { ActionResult } from "@/lib/types/action-result"
import { parseProgram, applyPipeline } from "@/lib/utils/sound-change"
import { createActivity } from "@/lib/utils/activity"
import { isAdmin } from "@/lib/admin"
import { logAdminAction } from "@/app/actions/admin-audit"
import { scanBundle } from "@/lib/modules/scan"
import { z } from "zod"
import { rulesTextFromData } from "@/lib/modules/utils"
import type { ModuleTier } from "@prisma/client"
import {
  createModuleSchema,
  updateModuleSchema,
  publishVersionSchema,
  addModuleSchema,
  reviewModuleSchema,
  reportModuleSchema,
  type CreateModuleInput,
  type UpdateModuleInput,
  type PublishVersionInput,
  type AddModuleInput,
  type ReviewModuleInput,
  type ReportModuleInput,
} from "@/lib/validations/module"

type OwnerGuard =
  | { ok: false; error: string }
  | { ok: true; module: { id: string; authorId: string; slug: string; tier: ModuleTier } }

async function requireModuleOwner(moduleId: string, userId: string): Promise<OwnerGuard> {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { id: true, authorId: true, slug: true, tier: true },
  })
  if (!mod) return { ok: false, error: "Module not found" }
  if (mod.authorId !== userId) return { ok: false, error: "Forbidden" }
  return { ok: true, module: mod }
}

export async function createModule(
  input: CreateModuleInput
): Promise<ActionResult<{ id: string; slug: string }>> {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  const parsed = createModuleSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  const d = parsed.data

  const existing = await prisma.module.findUnique({ where: { slug: d.slug }, select: { id: true } })
  if (existing) return { error: "That slug is already taken" }

  const mod = await prisma.module.create({
    data: {
      slug: d.slug,
      name: d.name,
      type: d.type,
      tier: d.tier,
      summary: d.summary || null,
      description: d.description || null,
      icon: d.icon || null,
      repoUrl: d.repoUrl || null,
      homepageUrl: d.homepageUrl || null,
      license: d.license || null,
      tags: d.tags ?? undefined,
      authorId: userId,
      status: "DRAFT",
    },
    select: { id: true, slug: true },
  })

  revalidatePath("/dashboard/modules")
  return { success: true, data: mod }
}

export async function updateModule(input: UpdateModuleInput): Promise<ActionResult> {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  const parsed = updateModuleSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  const { id, ...rest } = parsed.data

  const owner = await requireModuleOwner(id, userId)
  if (!owner.ok) return { error: owner.error }

  await prisma.module.update({
    where: { id },
    data: {
      ...(rest.name !== undefined ? { name: rest.name } : {}),
      ...(rest.type !== undefined ? { type: rest.type } : {}),
      ...(rest.tier !== undefined ? { tier: rest.tier } : {}),
      ...(rest.summary !== undefined ? { summary: rest.summary || null } : {}),
      ...(rest.description !== undefined ? { description: rest.description || null } : {}),
      ...(rest.icon !== undefined ? { icon: rest.icon || null } : {}),
      ...(rest.repoUrl !== undefined ? { repoUrl: rest.repoUrl || null } : {}),
      ...(rest.homepageUrl !== undefined ? { homepageUrl: rest.homepageUrl || null } : {}),
      ...(rest.license !== undefined ? { license: rest.license || null } : {}),
      ...(rest.tags !== undefined ? { tags: rest.tags ?? undefined } : {}),
    },
  })

  revalidatePath("/dashboard/modules")
  revalidatePath(`/modules/${owner.module.slug}`)
  return { success: true }
}

/**
 * Publish a new immutable version of a module. For Phase 0 there is no review
 * pipeline yet, so publishing a version also marks the module PUBLISHED.
 */
export async function publishVersion(
  input: PublishVersionInput
): Promise<ActionResult<{ versionId: string }>> {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  const parsed = publishVersionSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  const d = parsed.data

  const owner = await requireModuleOwner(d.moduleId, userId)
  if (!owner.ok) return { error: owner.error }

  const dupe = await prisma.moduleVersion.findUnique({
    where: { moduleId_version: { moduleId: d.moduleId, version: d.version } },
    select: { id: true },
  })
  if (dupe) return { error: `Version ${d.version} already exists` }

  // Client-sandbox bundles are statically scanned before they can be published.
  let bundleCode: string | null = null
  if (d.bundleCode && d.bundleCode.trim()) {
    if (owner.module.tier !== "CLIENT_SANDBOX") {
      return { error: "Widget code is only allowed for client-sandbox modules" }
    }
    const scan = scanBundle(d.bundleCode)
    if (!scan.ok) return { error: `Bundle rejected: ${scan.reason}` }
    bundleCode = d.bundleCode
  }

  const created = await prisma.$transaction(async (tx) => {
    const version = await tx.moduleVersion.create({
      data: {
        moduleId: d.moduleId,
        version: d.version,
        changelog: d.changelog || null,
        sdkRange: d.sdkRange || null,
        permissions: d.permissions ?? undefined,
        data: d.data ?? undefined,
        bundleUrl: d.bundleUrl || null,
        bundleHash: d.bundleHash || null,
        bundleCode,
        manifest: {
          id: owner.module.slug,
          version: d.version,
          permissions: d.permissions ?? [],
        },
        publishedAt: new Date(),
      },
      select: { id: true },
    })

    await tx.module.update({
      where: { id: d.moduleId },
      data: { status: "PUBLISHED" },
    })

    return version
  })

  revalidatePath("/dashboard/modules")
  revalidatePath("/modules")
  revalidatePath(`/modules/${owner.module.slug}`)
  return { success: true, data: { versionId: created.id } }
}

/** Add (install) a module for the current user — account-wide or scoped to a language. */
export async function addModule(input: AddModuleInput): Promise<ActionResult> {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  const parsed = addModuleSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  const { moduleId, grantedPermissions, settings } = parsed.data
  const languageId = parsed.data.languageId ?? null

  // Adding to a specific language requires edit rights on that language.
  if (languageId) {
    const allowed = await canEditScope(languageId, userId, "manage:modules")
    if (!allowed) return { error: "You can't add modules to this language" }
  }

  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { id: true, slug: true, status: true },
  })
  if (!mod || mod.status !== "PUBLISHED") return { error: "Module is not available" }

  const latest = await prisma.moduleVersion.findFirst({
    where: { moduleId, yanked: false, publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    select: { id: true },
  })
  if (!latest) return { error: "Module has no published version yet" }

  const existing = await prisma.moduleInstall.findFirst({
    where: { moduleId, userId, languageId },
    select: { id: true, enabled: true },
  })

  if (existing) {
    await prisma.moduleInstall.update({
      where: { id: existing.id },
      data: {
        versionId: latest.id,
        enabled: true,
        grantedPermissions: grantedPermissions ?? undefined,
        settings: settings ?? undefined,
      },
    })
    if (!existing.enabled) {
      await prisma.module.update({ where: { id: moduleId }, data: { addCount: { increment: 1 } } })
    }
  } else {
    await prisma.$transaction([
      prisma.moduleInstall.create({
        data: {
          moduleId,
          versionId: latest.id,
          userId,
          languageId,
          enabled: true,
          grantedPermissions: grantedPermissions ?? undefined,
          settings: settings ?? undefined,
        },
      }),
      prisma.module.update({ where: { id: moduleId }, data: { addCount: { increment: 1 } } }),
    ])
  }

  revalidatePath(`/modules/${mod.slug}`)
  revalidatePath("/settings/modules")

  const langs = languageId
    ? await prisma.language.findMany({
        where: { id: languageId },
        select: { slug: true },
      })
    : await prisma.language.findMany({
        where: { ownerId: userId },
        select: { slug: true },
      })

  for (const lang of langs) {
    revalidatePath(`/studio/lang/${lang.slug}/modules`)
    revalidatePath(`/studio/lang/${lang.slug}`, "layout")
    revalidatePath(`/lang/${lang.slug}`)
  }

  return { success: true }
}

/** Remove (uninstall) a module the current user added. */
export async function removeModule(installId: string): Promise<ActionResult> {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  const install = await prisma.moduleInstall.findUnique({
    where: { id: installId },
    select: {
      id: true,
      userId: true,
      enabled: true,
      moduleId: true,
      module: { select: { slug: true } },
      language: { select: { slug: true } },
    },
  })
  if (!install || install.userId !== userId) return { error: "Not found" }

  await prisma.$transaction([
    prisma.moduleInstall.delete({ where: { id: installId } }),
    ...(install.enabled
      ? [prisma.module.update({ where: { id: install.moduleId }, data: { addCount: { decrement: 1 } } })]
      : []),
  ])

  revalidatePath(`/modules/${install.module.slug}`)
  revalidatePath("/settings/modules")

  const langs = install.language
    ? [{ slug: install.language.slug }]
    : await prisma.language.findMany({ where: { ownerId: userId }, select: { slug: true } })

  for (const lang of langs) {
    revalidatePath(`/studio/lang/${lang.slug}/modules`)
    revalidatePath(`/studio/lang/${lang.slug}`, "layout")
    revalidatePath(`/lang/${lang.slug}`)
  }

  return { success: true }
}

export async function reviewModule(input: ReviewModuleInput): Promise<ActionResult> {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  const parsed = reviewModuleSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  const { moduleId, rating, body } = parsed.data

  const mod = await prisma.module.findUnique({ where: { id: moduleId }, select: { slug: true } })
  if (!mod) return { error: "Module not found" }

  const prior = await prisma.moduleReview.findUnique({
    where: { moduleId_userId: { moduleId, userId } },
    select: { rating: true },
  })

  await prisma.$transaction(async (tx) => {
    await tx.moduleReview.upsert({
      where: { moduleId_userId: { moduleId, userId } },
      create: { moduleId, userId, rating, body: body || null },
      update: { rating, body: body || null },
    })

    const sumDelta = prior ? rating - prior.rating : rating
    const countDelta = prior ? 0 : 1

    const updated = await tx.module.update({
      where: { id: moduleId },
      data: { 
        ratingSum: { increment: sumDelta },
        ...(countDelta > 0 ? { ratingCount: { increment: countDelta } } : {})
      },
      select: { ratingSum: true, ratingCount: true }
    })

    await tx.module.update({
      where: { id: moduleId },
      data: { ratingAverage: updated.ratingCount > 0 ? updated.ratingSum / updated.ratingCount : 0 }
    })
  })

  revalidatePath(`/modules/${mod.slug}`)
  return { success: true }
}

export async function reportModule(input: ReportModuleInput): Promise<ActionResult> {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  const parsed = reportModuleSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" }

  const mod = await prisma.module.findUnique({ where: { id: parsed.data.moduleId }, select: { id: true } })
  if (!mod) return { error: "Module not found" }

  await prisma.moduleReport.create({
    data: { moduleId: mod.id, reporterId: userId, reason: parsed.data.reason },
  })
  return { success: true }
}

// ───────────────────────────────────────────────────────────────────────────
// Declarative transformer runtime (Tier 0) — applies a module's rule pack to a
// language's dictionary using the built-in sound-change engine. No sandbox
// needed: the module only contributes data, the platform runs trusted code.
// ───────────────────────────────────────────────────────────────────────────



/**
 * Resolve the enabled install of `moduleId` for `userId` on `languageId`
 * (or account-wide), returning the rule text from its pinned version.
 */
type LoadedRules =
  | { ok: false; error: string }
  | { ok: true; rules: ReturnType<typeof parseProgram>["rules"]; classes: ReturnType<typeof parseProgram>["classes"] }

async function loadTransformerRules(
  userId: string,
  moduleId: string,
  languageId: string
): Promise<LoadedRules> {
  const install = await prisma.moduleInstall.findFirst({
    where: {
      userId,
      moduleId,
      enabled: true,
      OR: [{ languageId }, { languageId: null }],
    },
    include: { version: { select: { data: true } } },
  })
  if (!install) return { ok: false, error: "This module is not added to this language" }
  const rulesText = rulesTextFromData(install.version.data)
  if (!rulesText.trim()) return { ok: false, error: "This module has no rules to apply" }
  const { classes, rules } = parseProgram(rulesText)
  if (rules.length === 0) return { ok: false, error: "No valid rules could be parsed" }
  return { ok: true, rules, classes }
}

export type TransformPreview = ActionResult<{
  changed: { id: string; before: string; after: string }[]
  changedCount: number
  total: number
}>

export async function previewModuleTransform(
  languageId: string,
  moduleId: string
): Promise<TransformPreview> {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }
  if (!(await canEditScope(languageId, userId, "manage:modules"))) return { error: "Forbidden" }

  const loaded = await loadTransformerRules(userId, moduleId, languageId)
  if (!loaded.ok) return { error: loaded.error }

  const entries = await prisma.dictionaryEntry.findMany({
    where: { languageId },
    select: { id: true, lemma: true },
  })

  const changed: { id: string; before: string; after: string }[] = []
  for (const e of entries) {
    const result = applyPipeline(e.lemma, loaded.rules, undefined, undefined, loaded.classes)
    if (result.changed !== result.original) {
      changed.push({ id: e.id, before: result.original, after: result.changed })
    }
  }

  return {
    success: true,
    data: { changed: changed.slice(0, 25), changedCount: changed.length, total: entries.length },
  }
}

export type TransformApply = ActionResult<{ applied: number; unchanged: number }>

export async function applyModuleTransform(
  languageId: string,
  moduleId: string
): Promise<TransformApply> {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }
  if (!(await canEditScope(languageId, userId, "manage:modules"))) return { error: "Forbidden" }

  const loaded = await loadTransformerRules(userId, moduleId, languageId)
  if (!loaded.ok) return { error: loaded.error }

  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { slug: true },
  })
  if (!language) return { error: "Language not found" }

  const entries = await prisma.dictionaryEntry.findMany({
    where: { languageId },
    select: { id: true, lemma: true },
  })

  const updates: { id: string; lemma: string }[] = []
  for (const e of entries) {
    const result = applyPipeline(e.lemma, loaded.rules, undefined, undefined, loaded.classes)
    if (result.changed !== result.original) updates.push({ id: e.id, lemma: result.changed })
  }

  if (updates.length === 0) {
    return { success: true, data: { applied: 0, unchanged: entries.length } }
  }

  await prisma.$transaction(
    updates.map((u) =>
      prisma.dictionaryEntry.update({ where: { id: u.id }, data: { lemma: u.lemma } })
    )
  )

  await createActivity({
    type: "UPDATED",
    entityType: "DICTIONARY_ENTRY",
    entityId: languageId,
    languageId,
    userId,
    description: `Applied a module transformer to ${updates.length} dictionary entries`,
    metadata: { moduleId, updatedCount: updates.length },
  })

  revalidatePath(`/studio/lang/${language.slug}/dictionary`)
  revalidatePath(`/lang/${language.slug}/dictionary`)

  return { success: true, data: { applied: updates.length, unchanged: entries.length - updates.length } }
}

// ───────────────────────────────────────────────────────────────────────────
// Admin moderation
// ───────────────────────────────────────────────────────────────────────────

const adminStatusSchema = z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "SUSPENDED", "DEPRECATED"])
const reportStatusSchema = z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"])

export async function adminSetModuleStatus(
  moduleId: string,
  status: string
): Promise<ActionResult> {
  if (!(await isAdmin())) return { error: "Forbidden" }
  const parsed = adminStatusSchema.safeParse(status)
  if (!parsed.success) return { error: "Invalid status" }

  const mod = await prisma.module.update({
    where: { id: moduleId },
    data: { status: parsed.data },
    select: { slug: true },
  })

  await logAdminAction({
    action: "SET_MODULE_STATUS",
    resource: "MODULE",
    resourceId: moduleId,
    details: { status: parsed.data },
  })

  revalidatePath("/admin/modules")
  revalidatePath("/modules")
  revalidatePath(`/modules/${mod.slug}`)
  return { success: true }
}

export async function adminYankVersion(versionId: string, yanked: boolean): Promise<ActionResult> {
  if (!(await isAdmin())) return { error: "Forbidden" }

  const version = await prisma.moduleVersion.update({
    where: { id: versionId },
    data: { yanked },
    select: { module: { select: { slug: true } } },
  })

  await logAdminAction({
    action: yanked ? "YANK_MODULE_VERSION" : "UNYANK_MODULE_VERSION",
    resource: "MODULE_VERSION",
    resourceId: versionId,
  })

  revalidatePath("/admin/modules")
  revalidatePath(`/modules/${version.module.slug}`)
  return { success: true }
}

export async function adminResolveReport(reportId: string, status: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { error: "Forbidden" }
  const parsed = reportStatusSchema.safeParse(status)
  if (!parsed.success) return { error: "Invalid status" }

  await prisma.moduleReport.update({
    where: { id: reportId },
    data: { status: parsed.data },
  })

  await logAdminAction({
    action: "RESOLVE_MODULE_REPORT",
    resource: "MODULE_REPORT",
    resourceId: reportId,
    details: { status: parsed.data },
  })

  revalidatePath("/admin/modules")
  return { success: true }
}
