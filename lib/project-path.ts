/**
 * Request header the middleware sets to the requested pathname on /lang/… and
 * /studio/lang/… requests (server layouts cannot see their own sub-path otherwise).
 * The middleware always overwrites it, so a client cannot supply its own.
 */
export const PATHNAME_HEADER = "x-lingocon-pathname"

const PROJECT_PATH = /^(\/studio\/lang|\/lang)\/([^/?#]+)(\/[^?#]*)?$/

export interface ProjectPath {
  /** "/studio/lang" or "/lang". */
  prefix: string
  slug: string
  /** The section below the project ("" for its home), e.g. "/grammar/nouns". */
  rest: string
}

/** Splits a studio or public project path, or null for anything else. */
export function parseProjectPath(pathname: string | null | undefined): ProjectPath | null {
  const match = pathname?.match(PROJECT_PATH)
  if (!match) return null
  return { prefix: match[1], slug: decodeURIComponent(match[2]), rest: match[3] && match[3] !== "/" ? match[3] : "" }
}

/**
 * The same section of a renamed project: `/studio/lang/old/grammar/x` →
 * `/studio/lang/new/grammar/x`. When `pathname` is not a path of `oldSlug` (missing or
 * unexpected), falls back to the project's home under `prefix`.
 */
export function withRenamedSlug(pathname: string | null | undefined, prefix: string, oldSlug: string, newSlug: string): string {
  const parsed = parseProjectPath(pathname)
  const rest = parsed && parsed.prefix === prefix && parsed.slug === oldSlug ? parsed.rest : ""
  return `${prefix}/${encodeURIComponent(newSlug)}${rest}`
}
