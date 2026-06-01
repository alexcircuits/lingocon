/**
 * Centralized SEO utilities.
 *
 * Single source of truth for the canonical site origin, Open Graph / Twitter
 * defaults, and per-language metadata generation. Use these helpers instead of
 * re-deriving `process.env.NEXT_PUBLIC_SITE_URL || "https://lingocon.com"`
 * inline so canonical URLs stay consistent across environments (staging vs
 * production) and so per-language pages get rich, indexable metadata.
 */
import type { Metadata } from "next"

export const SITE_NAME = "LingoCon"
export const SITE_TAGLINE = "Conlang Tool & Constructed Language Platform"
export const DEFAULT_LOCALE = "en_US"

/** Canonical public origin, e.g. `https://lingocon.com` (no trailing slash). */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "https://lingocon.com"
  return raw.replace(/\/$/, "")
}

/**
 * Origin used to render dynamic OG images via route handlers. Falls back to the
 * canonical site URL so a single env var (`NEXT_PUBLIC_SITE_URL`) is enough.
 */
export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || getSiteUrl()
  return raw.replace(/\/$/, "")
}

/** Build an absolute URL from a path (leading slash optional). */
export function absoluteUrl(path = ""): string {
  if (!path) return getSiteUrl()
  if (path.startsWith("http")) return path
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`
}

/** Resolve an asset URL that may be relative (uploads) or already absolute. */
export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return url.startsWith("http") ? url : `${getSiteUrl()}${url.startsWith("/") ? url : `/${url}`}`
}

/** Truncate text to a sensible meta-description length without cutting words. */
export function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max - 1).trimEnd() + "…"
}

/** Dynamic OG image URL for a language's family-tree card. */
export function languageOgImage(languageId: string): string {
  return `${getAppUrl()}/api/og/family-tree/${languageId}`
}

/** Robots block that keeps a page out of the index but still followable. */
export const NOINDEX_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: true,
}

type LanguageSeoInput = {
  id: string
  name: string
  slug: string
  description?: string | null
  flagUrl?: string | null
  visibility?: string | null
}

type SubPageSeoOptions = {
  /** Path segment after the language root, e.g. "dictionary" or "grammar". */
  section?: string
  /** Human label used in the title, e.g. "Dictionary". */
  sectionLabel?: string
  /** Explicit title override (takes precedence over the generated section title). */
  title?: string
  /** Explicit description override. */
  description?: string
  /** Extra keywords to merge in. */
  keywords?: string[]
}

/**
 * Build consistent, index-ready metadata for any page scoped to a single
 * language. Handles canonical URLs, Open Graph (flag + dynamic family-tree
 * card), Twitter, keywords, and automatically `noindex`es UNLISTED languages.
 */
export function buildLanguageMetadata(
  language: LanguageSeoInput,
  options: SubPageSeoOptions = {}
): Metadata {
  const siteUrl = getSiteUrl()
  const { section, sectionLabel } = options

  const path = section ? `/lang/${language.slug}/${section}` : `/lang/${language.slug}`
  const url = `${siteUrl}${path}`

  const title =
    options.title ??
    (sectionLabel
      ? `${sectionLabel} — ${language.name} Conlang`
      : `${language.name} — Constructed Language on ${SITE_NAME}`)

  const description = options.description
    ? truncate(options.description, 200)
    : language.description
      ? truncate(language.description, 200)
      : sectionLabel
        ? `Explore the ${sectionLabel.toLowerCase()} of ${language.name}, a constructed language documented on ${SITE_NAME} — the free platform for conlang creators.`
        : `Explore ${language.name}, a constructed language (conlang) documented on ${SITE_NAME} — the free platform for conlang creators.`

  const ogImages: { url: string; width: number; height: number; alt: string }[] = []
  const flag = resolveAssetUrl(language.flagUrl)
  if (flag) {
    ogImages.push({ url: flag, width: 800, height: 600, alt: `Flag of the ${language.name} constructed language` })
  }
  ogImages.push({
    url: languageOgImage(language.id),
    width: 1200,
    height: 630,
    alt: `${language.name} language family tree on ${SITE_NAME}`,
  })

  const keywords = [
    language.name,
    `${language.name} conlang`,
    `${language.name} constructed language`,
    `${language.name} language`,
    `${language.name} dictionary`,
    `${language.name} grammar`,
    "conlang",
    "constructed language",
    SITE_NAME,
    ...(options.keywords ?? []),
  ]

  const isUnlisted = language.visibility === "UNLISTED"

  return {
    title,
    description,
    keywords,
    ...(isUnlisted ? { robots: NOINDEX_ROBOTS } : {}),
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      locale: DEFAULT_LOCALE,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImages[0].url],
    },
    alternates: {
      canonical: url,
    },
  }
}

/** BreadcrumbList JSON-LD builder. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  const siteUrl = getSiteUrl()
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.path.startsWith("http") ? item.path : `${siteUrl}${item.path}`,
    })),
  }
}
