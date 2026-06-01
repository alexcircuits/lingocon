/**
 * Read-side helpers for the Modules marketplace.
 *
 * These are plain async functions (not Server Actions) so they can be called
 * directly from React Server Components. Mutations live in `app/actions/module.ts`.
 */
import { prisma } from "@/lib/prisma"
import type { ModuleType, Prisma } from "@prisma/client"
import { parseThemeData, type ResolvedTheme } from "@/lib/modules/theme"
import { STUDIO_NAV_TYPES } from "@/lib/modules/surfaces"

function resolveGrantedPermissions(
  granted: unknown,
  declared: unknown
): string[] {
  const g = granted as string[] | null
  const d = declared as string[] | null
  if (g && g.length > 0) return g
  return d ?? []
}

export const MODULE_CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  type: true,
  tier: true,
  icon: true,
  isOfficial: true,
  isVerifiedAuthor: true,
  addCount: true,
  ratingSum: true,
  ratingCount: true,
  updatedAt: true,
  author: { select: { id: true, name: true, image: true } },
} satisfies Prisma.ModuleSelect

export type ModuleSort = "popular" | "recent" | "rating" | "name"

export async function listPublishedModules(opts: {
  type?: ModuleType
  query?: string
  sort?: ModuleSort
  page?: number
  pageSize?: number
} = {}) {
  const { type, query, sort = "popular", page = 1, pageSize = 24 } = opts

  const where: Prisma.ModuleWhereInput = {
    status: "PUBLISHED",
    ...(type ? { type } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { summary: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const orderBy: Prisma.ModuleOrderByWithRelationInput =
    sort === "recent"
      ? { updatedAt: "desc" }
      : sort === "rating"
      ? { ratingCount: "desc" }
      : sort === "name"
      ? { name: "asc" }
      : { addCount: "desc" }

  const [modules, total] = await Promise.all([
    prisma.module.findMany({
      where,
      select: MODULE_CARD_SELECT,
      orderBy,
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.module.count({ where }),
  ])

  return { modules, total, page, totalPages: Math.ceil(total / pageSize) }
}

export async function getModuleBySlug(slug: string) {
  return prisma.module.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true, image: true } },
      versions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { id: true, name: true, image: true } } },
      },
    },
  })
}

export async function getAuthorModules(authorId: string) {
  return prisma.module.findMany({
    where: { authorId },
    select: { ...MODULE_CARD_SELECT, status: true },
    orderBy: { updatedAt: "desc" },
  })
}

/**
 * Modules a given user has enabled for a language — either scoped to that
 * language or added account-wide (languageId = null). Optionally filter by type.
 */
export async function getEnabledInstallsForUser(
  userId: string,
  languageId: string,
  type?: ModuleType
) {
  return prisma.moduleInstall.findMany({
    where: {
      userId,
      enabled: true,
      OR: [{ languageId }, { languageId: null }],
      module: {
        status: "PUBLISHED",
        ...(type ? { type } : {}),
      },
    },
    include: {
      module: { select: { id: true, slug: true, name: true, icon: true, type: true } },
      version: { select: { id: true, version: true, manifest: true } },
    },
    orderBy: { createdAt: "asc" },
  })
}

/** Reader-facing module types on a public language page. */
const READER_FACING_TYPES: ModuleType[] = ["READER_WIDGET", "VISUALIZER"]

/** Installs that should appear as dynamic studio sidebar tabs. */
export async function getStudioNavInstalls(userId: string, languageId: string) {
  return prisma.moduleInstall.findMany({
    where: {
      userId,
      enabled: true,
      OR: [{ languageId }, { languageId: null }],
      module: { status: "PUBLISHED", type: { in: STUDIO_NAV_TYPES } },
    },
    include: {
      module: { select: { id: true, slug: true, name: true, icon: true, type: true } },
      version: { select: { version: true, permissions: true, bundleCode: true } },
    },
    orderBy: { createdAt: "asc" },
  })
}

export type PublicReaderModule = {
  moduleId: string
  slug: string
  name: string
  summary: string | null
  icon: string | null
  type: ModuleType
  permissions: string[]
  bundleCode: string | null
}

/**
 * Reader-facing modules the language OWNER has enabled (scoped to the language
 * or account-wide). These render to every public visitor — owner-only control.
 */
export async function getPublicReaderModules(
  ownerId: string,
  languageId: string
): Promise<PublicReaderModule[]> {
  const installs = await prisma.moduleInstall.findMany({
    where: {
      userId: ownerId,
      enabled: true,
      OR: [{ languageId }, { languageId: null }],
      module: { status: "PUBLISHED", type: { in: READER_FACING_TYPES } },
    },
    select: {
      grantedPermissions: true,
      module: { select: { id: true, slug: true, name: true, summary: true, icon: true, type: true } },
      version: { select: { permissions: true, bundleCode: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  // De-dupe by module (a module could be added both account-wide and per-language).
  const seen = new Set<string>()
  const out: PublicReaderModule[] = []
  for (const i of installs) {
    if (seen.has(i.module.id)) continue
    seen.add(i.module.id)
    out.push({
      moduleId: i.module.id,
      slug: i.module.slug,
      name: i.module.name,
      summary: i.module.summary,
      icon: i.module.icon,
      type: i.module.type,
      permissions: resolveGrantedPermissions(i.grantedPermissions, i.version.permissions),
      bundleCode: i.version.bundleCode ?? null,
    })
  }
  return out
}

/**
 * For the given module ids, which has the visitor already added account-wide?
 * Returns a `moduleId → installId` map so the UI can offer removal.
 */
export async function getVisitorAccountInstalls(
  userId: string,
  moduleIds: string[]
): Promise<Record<string, string>> {
  if (moduleIds.length === 0) return {}
  const rows = await prisma.moduleInstall.findMany({
    where: { userId, languageId: null, moduleId: { in: moduleIds } },
    select: { id: true, moduleId: true },
  })
  return Object.fromEntries(rows.map((r) => [r.moduleId, r.id]))
}

export type ActiveTheme = {
  moduleId: string
  slug: string
  name: string
  theme: ResolvedTheme
}

/**
 * The THEME the language OWNER has enabled for this language (scoped or
 * account-wide). The most recently added enabled theme wins. Returns the
 * validated, render-ready descriptor or null.
 */
export async function getActiveThemeForLanguage(
  ownerId: string,
  languageId: string
): Promise<ActiveTheme | null> {
  const install = await prisma.moduleInstall.findFirst({
    where: {
      userId: ownerId,
      enabled: true,
      OR: [{ languageId }, { languageId: null }],
      module: { status: "PUBLISHED", type: "THEME" },
    },
    include: {
      module: { select: { id: true, slug: true, name: true } },
      version: { select: { data: true } },
    },
    // Prefer a language-scoped theme over an account-wide one, then newest.
    orderBy: [{ languageId: "desc" }, { createdAt: "desc" }],
  })

  if (!install) return null
  const theme = parseThemeData(install.version.data)
  if (!theme) return null

  return {
    moduleId: install.module.id,
    slug: install.module.slug,
    name: install.module.name,
    theme,
  }
}

/** Is a module already added by this user (account-wide or for this language)? */
export async function getInstallState(
  userId: string,
  moduleId: string,
  languageId: string | null
) {
  return prisma.moduleInstall.findFirst({
    where: { moduleId, userId, languageId },
    select: { id: true, enabled: true, versionId: true },
  })
}
