/**
 * Canonical identity for the database row used when `DEV_MODE="true"`.
 *
 * Keep these values centralized so `auth.ts` and `lib/dev-auth.ts` never drift apart.
 */
export const DEV_MODE_USER_EMAIL = "dev@localhost" as const
export const DEV_MODE_USER_DISPLAY_NAME = "Dev User" as const
