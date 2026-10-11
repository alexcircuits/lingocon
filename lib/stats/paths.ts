/**
 * Page paths for the anonymous statistics: a page view is stored as its route template
 * (`/studio/lang/[slug]/dictionary`), never the URL, so no private project name, user id or
 * whatever someone typed into a URL ends up in the database. Reader and learn pages offer their
 * language slug as a candidate, which lib/stats/languages.ts keeps only for PUBLIC languages.
 */

/** Every page route of the app (each page.tsx under app/, route groups removed). A test keeps it in sync. */
export const PAGE_ROUTES = [
  "/",
  "/admin",
  "/admin/analytics",
  "/admin/audit",
  "/admin/content",
  "/admin/languages",
  "/admin/languages/[id]",
  "/admin/modules",
  "/admin/surveys",
  "/admin/system",
  "/admin/traffic",
  "/admin/users",
  "/admin/users/[id]",
  "/browse",
  "/contact",
  "/contributions",
  "/cookies",
  "/dashboard",
  "/dashboard/families",
  "/dashboard/families/manage",
  "/dashboard/feed",
  "/dashboard/modules",
  "/dashboard/modules/[id]",
  "/dashboard/modules/new",
  "/dashboard/modules/playground",
  "/dashboard/new-language",
  "/dashboard/translate-ui",
  "/docs",
  "/docs/[slug]",
  "/donate",
  "/families",
  "/favorites",
  "/forgot-password",
  "/lang/[slug]",
  "/lang/[slug]/alphabet",
  "/lang/[slug]/articles",
  "/lang/[slug]/articles/[articleSlug]",
  "/lang/[slug]/dictionary",
  "/lang/[slug]/flashcards",
  "/lang/[slug]/grammar",
  "/lang/[slug]/grammar/[pageSlug]",
  "/lang/[slug]/paradigms",
  "/lang/[slug]/phonology",
  "/lang/[slug]/texts",
  "/lang/[slug]/texts/[textSlug]",
  "/learn",
  "/learn/[slug]",
  "/learn/[slug]/courses/[courseId]",
  "/learn/[slug]/lesson/[lessonId]",
  "/learn/[slug]/practice",
  "/learn/[slug]/progress",
  "/learn/[slug]/study",
  "/learn/browse",
  "/learn/leaderboard",
  "/learn/leagues",
  "/learn/quests",
  "/login",
  "/modules",
  "/modules/[slug]",
  "/modules/docs",
  "/register",
  "/reset-password",
  "/search",
  "/settings",
  "/settings/extension",
  "/settings/modules",
  "/studio/lang/[slug]",
  "/studio/lang/[slug]/alphabet",
  "/studio/lang/[slug]/articles",
  "/studio/lang/[slug]/articles/[articleSlug]",
  "/studio/lang/[slug]/articles/new",
  "/studio/lang/[slug]/courses",
  "/studio/lang/[slug]/courses/[courseId]",
  "/studio/lang/[slug]/dictionary",
  "/studio/lang/[slug]/flashcards",
  "/studio/lang/[slug]/grammar",
  "/studio/lang/[slug]/grammar/[pageSlug]",
  "/studio/lang/[slug]/grammar/new",
  "/studio/lang/[slug]/modules",
  "/studio/lang/[slug]/modules/[moduleSlug]",
  "/studio/lang/[slug]/paradigms",
  "/studio/lang/[slug]/phonology",
  "/studio/lang/[slug]/settings",
  "/studio/lang/[slug]/sound-changes",
  "/studio/lang/[slug]/texts",
  "/studio/lang/[slug]/texts/[textSlug]",
  "/studio/lang/[slug]/texts/new",
  "/studio/lang/[slug]/translate",
  "/survey",
  "/survey/[slug]",
  "/users/[userId]",
  "/verify-email",
] as const

/** Stored for any URL that matches no page (typos, probes): its text is never kept. */
export const OTHER_PATH = "(other)"

const MAX_PATH_LENGTH = 512
const EXCLUDED_PREFIXES = ["/admin", "/api", "/_next"]
const PUBLIC_LANGUAGE_PREFIXES = ["/lang/[slug]", "/learn/[slug]"]
const SLUG = /^[a-z0-9-]{1,100}$/

interface Template {
  route: string
  segments: string[]
  literals: number
}

const TEMPLATES: Template[] = PAGE_ROUTES.map((route) => {
  const segments = route.split("/").filter(Boolean)
  return { route, segments, literals: segments.filter((s) => !s.startsWith("[")).length }
})

export interface NormalizedPath {
  path: string
  languageSlug: string | null
}

function isExcluded(pathname: string): boolean {
  return EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))
}

/** The template a path is counted under, or null when it is not counted at all. */
export function normalizePath(raw: string): NormalizedPath | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.length > MAX_PATH_LENGTH) return null
  const pathname = raw.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/"
  if (isExcluded(pathname)) return null

  const segments = pathname.split("/").filter(Boolean)
  let best: Template | null = null
  for (const template of TEMPLATES) {
    if (template.segments.length !== segments.length) continue
    const matches = template.segments.every((part, i) => part.startsWith("[") || part === segments[i])
    if (matches && (!best || template.literals > best.literals)) best = template
  }
  if (!best) return { path: OTHER_PATH, languageSlug: null }

  const slug = segments[1]
  const keepsSlug = PUBLIC_LANGUAGE_PREFIXES.some((prefix) => best.route === prefix || best.route.startsWith(prefix + "/"))
  return { path: best.route, languageSlug: keepsSlug && SLUG.test(slug) ? slug : null }
}
