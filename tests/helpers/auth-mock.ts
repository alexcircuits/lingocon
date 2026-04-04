import { vi } from "vitest"

/**
 * Mock auth helpers for testing.
 * Call at module scope to set up the mock, then use the returned
 * functions to control auth state per test.
 *
 * @example
 * ```ts
 * const { mockAuthenticated, mockUnauthenticated } = setupAuthMock()
 *
 * test("rejects unauthenticated", async () => {
 *   mockUnauthenticated()
 *   // ... test action
 * })
 *
 * test("allows authenticated user", async () => {
 *   mockAuthenticated("user-123")
 *   // ... test action
 * })
 * ```
 */
export function setupAuthMock() {
  const getUserId = vi.fn<() => Promise<string | null>>()
  const requireAuth = vi.fn<() => Promise<string>>()
  const canEditLanguage = vi.fn<(languageId: string, userId: string | null) => Promise<boolean>>()
  const canViewLanguage = vi.fn<(languageId: string, userId: string | null) => Promise<boolean>>()
  const isLanguageOwner = vi.fn<(languageId: string, userId: string | null) => Promise<boolean>>()

  vi.mock("@/lib/auth-helpers", () => ({
    getUserId,
    requireAuth,
    canEditLanguage,
    canViewLanguage,
    isLanguageOwner,
  }))

  return {
    getUserId,
    requireAuth,
    canEditLanguage,
    canViewLanguage,
    isLanguageOwner,

    /** Set up mocks for an authenticated user */
    mockAuthenticated(userId: string = "test-user-id") {
      getUserId.mockResolvedValue(userId)
      requireAuth.mockResolvedValue(userId)
    },

    /** Set up mocks for an unauthenticated request */
    mockUnauthenticated() {
      getUserId.mockResolvedValue(null)
      requireAuth.mockRejectedValue(new Error("Unauthorized"))
    },

    /** Set up mocks for a user who can edit a specific language */
    mockCanEdit(languageId: string, userId: string = "test-user-id") {
      getUserId.mockResolvedValue(userId)
      requireAuth.mockResolvedValue(userId)
      canEditLanguage.mockImplementation(async (langId) => langId === languageId)
      isLanguageOwner.mockImplementation(async (langId) => langId === languageId)
    },

    /** Set up mocks for a user who cannot edit */
    mockCannotEdit(userId: string = "test-user-id") {
      getUserId.mockResolvedValue(userId)
      requireAuth.mockResolvedValue(userId)
      canEditLanguage.mockResolvedValue(false)
      isLanguageOwner.mockResolvedValue(false)
    },

    resetMocks() {
      vi.clearAllMocks()
    },
  }
}
