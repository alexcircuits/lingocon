/**
 * In-app documentation: maps URL slugs to markdown files under `/docs` in the repo root.
 * Keep this list in sync with files on disk — the reader refuses unknown filenames.
 */
export const SOURCE_REPO_README =
  "https://github.com/alexcircuits/lingocon/blob/main/README.md"

export type DocSlug =
  | "architecture"
  | "codebase"
  | "database"
  | "development"
  | "server-actions-and-api"

export type DocPageMeta = {
  slug: DocSlug
  /** File name inside the `docs/` directory */
  file: string
  title: string
  description: string
}

export const DOC_PAGES: DocPageMeta[] = [
  {
    slug: "architecture",
    file: "architecture.md",
    title: "Architecture",
    description:
      "How requests flow through Next.js, authentication, Prisma, and cache revalidation.",
  },
  {
    slug: "codebase",
    file: "CODEBASE.md",
    title: "Codebase map",
    description: "Where routes, components, server actions, and utilities live on disk.",
  },
  {
    slug: "database",
    file: "DATABASE.md",
    title: "Database",
    description: "Prisma models by domain, migrations, seeds, and JSON content fields.",
  },
  {
    slug: "development",
    file: "DEVELOPMENT.md",
    title: "Local development",
    description: "Environment variables, npm scripts, and common troubleshooting.",
  },
  {
    slug: "server-actions-and-api",
    file: "SERVER_ACTIONS_AND_API.md",
    title: "Server Actions & API",
    description: "When to use Server Actions vs Route Handlers and return-value conventions.",
  },
]

const SLUG_SET = new Set(DOC_PAGES.map((p) => p.slug))

export function isDocSlug(value: string): value is DocSlug {
  return SLUG_SET.has(value as DocSlug)
}

export function getDocPage(slug: DocSlug): DocPageMeta {
  const page = DOC_PAGES.find((p) => p.slug === slug)
  if (!page) throw new Error(`Unknown doc slug: ${slug}`)
  return page
}

/** Map markdown file names (as linked from other `.md` files) to in-app routes. */
export function resolveInternalDocHref(href: string | undefined): string | undefined {
  if (!href) return undefined

  if (href === "../README.md" || href.endsWith("/README.md")) {
    return SOURCE_REPO_README
  }

  const file = href.split("/").pop() ?? href
  const page = DOC_PAGES.find((p) => p.file === file)
  if (page) {
    return `/docs/${page.slug}`
  }

  if (file === "README.md") {
    return "/docs"
  }

  return href
}
