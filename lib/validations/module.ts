import { z } from "zod"
import { MODULE_PERMISSIONS } from "@/lib/modules/types"

const slugSchema = z
  .string()
  .min(3, "Slug must be at least 3 characters")
  .max(64)
  .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")

const semverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "Version must be semver, e.g. 1.0.0")

export const moduleTypeSchema = z.enum([
  "STUDIO_PANEL",
  "READER_WIDGET",
  "CONTENT_BLOCK",
  "TRANSFORMER",
  "GENERATOR",
  "EXPORTER",
  "IMPORTER",
  "VISUALIZER",
  "VALIDATOR",
  "THEME",
])

export const moduleTierSchema = z.enum(["DECLARATIVE", "CLIENT_SANDBOX", "SERVER"])

export const permissionSchema = z.enum(
  MODULE_PERMISSIONS as unknown as [string, ...string[]]
)

export const createModuleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: slugSchema,
  type: moduleTypeSchema,
  tier: moduleTierSchema.default("DECLARATIVE"),
  summary: z.string().max(200).optional(),
  description: z.string().max(20000).optional(),
  icon: z.string().max(64).optional(),
  repoUrl: z.string().url().optional().or(z.literal("")),
  homepageUrl: z.string().url().optional().or(z.literal("")),
  license: z.string().max(64).optional(),
  tags: z.array(z.string().max(32)).max(10).optional(),
})

export const updateModuleSchema = createModuleSchema
  .partial()
  .extend({ id: z.string().min(1) })

export const publishVersionSchema = z.object({
  moduleId: z.string().min(1),
  version: semverSchema,
  changelog: z.string().max(5000).optional(),
  sdkRange: z.string().max(64).optional(),
  permissions: z.array(permissionSchema).max(MODULE_PERMISSIONS.length).optional(),
  /** Declarative payload for Tier 0 modules (rules/theme/word list). */
  data: z.any().optional(),
  /** Hosted bundle reference for Tier 1+ modules. */
  bundleUrl: z.string().url().optional(),
  bundleHash: z.string().max(128).optional(),
  /** Inline sandboxed widget source for client-sandbox modules. */
  bundleCode: z.string().max(100000).optional(),
})

export const addModuleSchema = z.object({
  moduleId: z.string().min(1),
  /** Null/undefined => account-wide; otherwise scoped to this language. */
  languageId: z.string().min(1).optional().nullable(),
  grantedPermissions: z.array(permissionSchema).optional(),
  settings: z.any().optional(),
})

export const reviewModuleSchema = z.object({
  moduleId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).optional(),
})

export const reportModuleSchema = z.object({
  moduleId: z.string().min(1),
  reason: z.string().min(10, "Please describe the problem").max(2000),
})

export type CreateModuleInput = z.infer<typeof createModuleSchema>
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>
export type PublishVersionInput = z.infer<typeof publishVersionSchema>
export type AddModuleInput = z.infer<typeof addModuleSchema>
export type ReviewModuleInput = z.infer<typeof reviewModuleSchema>
export type ReportModuleInput = z.infer<typeof reportModuleSchema>
