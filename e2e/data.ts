/**
 * Fixture identities shared by e2e/seed.ts, e2e/auth.setup.ts and the specs.
 * Test-only accounts that exist solely in local/CI test databases (the seed
 * refuses any other database).
 */
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "e2e-Fixture-Pass-2026"

export const E2E_USERS = {
  owner: { email: "owner@e2e.test", name: "E2E Owner" },
  editor: { email: "editor@e2e.test", name: "E2E Editor" },
  viewer: { email: "viewer@e2e.test", name: "E2E Viewer" },
  stranger: { email: "stranger@e2e.test", name: "E2E Stranger" },
  admin: { email: "admin@e2e.test", name: "E2E Admin" },
  suspended: { email: "suspended@e2e.test", name: "E2E Suspended" },
} as const

export type E2eRole = keyof typeof E2E_USERS

/** Roles that can sign in (the suspended account is used to test that it cannot). */
export const SIGNED_IN_ROLES = ["owner", "editor", "viewer", "stranger", "admin"] as const satisfies readonly E2eRole[]

/** Owned by `owner`. The private one has `editor` (EDITOR) and `viewer` (VIEWER) collaborators. */
export const E2E_LANGUAGES = {
  public: "e2e-public",
  private: "e2e-private",
} as const

/** Content the seed puts in both fixture languages. */
export const E2E_CONTENT = {
  entries: ["tama", "kelo", "suna", "miro", "pala"],
  glosses: { tama: "water", kelo: "fire", suna: "sun", miro: "to see", pala: "hand" },
  grammarPages: [
    { slug: "introduction", title: "Introduction", text: "This is the E2E grammar introduction." },
    { slug: "nouns", title: "Nouns", text: "Nouns do not inflect for case." },
  ],
  paradigm: "Present tense",
  article: { slug: "welcome", title: "Welcome to the fixture" },
  text: { slug: "the-river", title: "The River" },
} as const

/** components/cookie-notice.tsx COOKIE_NOTICE_KEY (e2e/public/cookie-notice.spec.ts checks they match). */
export const COOKIE_NOTICE_KEY = "lingocon-cookie-notice-dismissed"

export function authFile(role: E2eRole): string {
  return `e2e/.auth/${role}.json`
}
