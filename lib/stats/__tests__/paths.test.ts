// @vitest-environment node
import { readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { normalizePath, PAGE_ROUTES } from "../paths"

describe("normalizePath", () => {
  it("keeps static routes as they are", () => {
    expect(normalizePath("/browse")).toEqual({ path: "/browse", languageSlug: null })
    expect(normalizePath("/")).toEqual({ path: "/", languageSlug: null })
    expect(normalizePath("/learn/leaderboard")).toEqual({ path: "/learn/leaderboard", languageSlug: null })
  })

  it("stores route templates, never ids or private project names", () => {
    expect(normalizePath("/studio/lang/secret-project/dictionary")).toEqual({
      path: "/studio/lang/[slug]/dictionary",
      languageSlug: null,
    })
    expect(normalizePath("/users/cmv2abc123xyz")).toEqual({ path: "/users/[userId]", languageSlug: null })
    expect(normalizePath("/learn/elvish/lesson/cmlesson1")).toEqual({
      path: "/learn/[slug]/lesson/[lessonId]",
      languageSlug: "elvish",
    })
  })

  it("prefers the most specific template (a literal segment beats a parameter)", () => {
    expect(normalizePath("/studio/lang/elvish/articles/new")?.path).toBe("/studio/lang/[slug]/articles/new")
    expect(normalizePath("/studio/lang/elvish/articles/field-notes")?.path).toBe("/studio/lang/[slug]/articles/[articleSlug]")
    expect(normalizePath("/learn/browse")?.path).toBe("/learn/browse")
    expect(normalizePath("/learn/elvish")).toEqual({ path: "/learn/[slug]", languageSlug: "elvish" })
  })

  it("keeps the language slug for public reader pages", () => {
    expect(normalizePath("/lang/elvish/grammar/verbs")).toEqual({ path: "/lang/[slug]/grammar/[pageSlug]", languageSlug: "elvish" })
  })

  it("drops the query string, the hash and a trailing slash", () => {
    expect(normalizePath("/browse/?q=elf&page=2#top")).toEqual({ path: "/browse", languageSlug: null })
  })

  it("collapses unknown URLs, which can contain anything, into one bucket", () => {
    expect(normalizePath("/my-email@example.com")).toEqual({ path: "(other)", languageSlug: null })
    expect(normalizePath("/lang/elvish/unknown/deep/path")).toEqual({ path: "(other)", languageSlug: null })
  })

  it("does not count admin pages, API calls or invalid input", () => {
    for (const raw of ["/admin", "/admin/users/abc", "/api/stats", "/_next/static/x.js", "browse", "", "/" + "a".repeat(600)]) {
      expect(normalizePath(raw), raw).toBeNull()
    }
  })

  it("ignores a slug that is not a slug", () => {
    expect(normalizePath("/lang/Not%20A%20Slug")).toEqual({ path: "/lang/[slug]", languageSlug: null })
  })
})

describe("PAGE_ROUTES", () => {
  it("covers every page of the app (route groups removed)", () => {
    const appDir = path.join(process.cwd(), "app")
    const found: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (name === "page.tsx") {
          const route = path
            .relative(appDir, dir)
            .split(path.sep)
            .filter((segment) => segment && !/^\(.*\)$/.test(segment))
            .join("/")
          found.push("/" + route)
        }
      }
    }
    walk(appDir)
    expect([...PAGE_ROUTES].sort()).toEqual(found.sort())
  })
})
