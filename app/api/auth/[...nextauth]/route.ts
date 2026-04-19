/**
 * Auth.js HTTP entrypoint — handles OAuth callbacks, CSRF checks, session cookies, etc.
 * All configuration lives in `auth.ts`; this file only re-exports the framework handlers.
 */
import { handlers } from "@/auth"

export const { GET, POST } = handlers
