/**
 * Startup environment validation.
 *
 * Fail fast at boot instead of mid-request: a missing `DATABASE_URL` or (in
 * production) `AUTH_SECRET` should crash the server immediately with a clear
 * message, not surface as a confusing 500 the first time a user hits an
 * authenticated route. Recommended-but-optional vars (email, canonical URL)
 * are reported as warnings so misconfiguration is visible without blocking
 * boot.
 *
 * Wired into the server lifecycle via the root `instrumentation.ts` `register()`
 * hook, which Next.js runs once when the server process starts.
 */
import { z } from "zod"

/** A loosely-typed source of env values (process.env or a test fixture). */
export type EnvSource = Record<string, string | undefined>

export interface EnvParseResult {
  success: boolean
  /** Fatal problems — boot must abort. */
  errors: string[]
  /** Non-fatal problems — boot continues, but something is likely misconfigured. */
  warnings: string[]
}

const optionalUrl = z
  .string()
  .url("must be a valid URL (including protocol)")
  .optional()

/**
 * Shape validation for any value that is present. Required-ness that depends on
 * the environment (prod vs dev) is enforced separately in {@link parseEnv} so we
 * can produce friendlier, environment-aware messages.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (Postgres connection string)"),
  DEV_MODE: z.string().optional(),

  // Auth
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_URL: optionalUrl,

  // OAuth providers (optional — credentials auth works without them)
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Email (Resend) — optional, but verification/reset email breaks without it
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Canonical origin — getSiteUrl() has a hardcoded fallback, so optional
  SITE_URL: optionalUrl,
  NEXT_PUBLIC_SITE_URL: optionalUrl,

  // Internal service auth + optional integrations
  INTERNAL_API_KEY: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
})

const PLACEHOLDER_SECRETS = [
  "change-me-in-production",
  "changeme",
  "secret",
  "generate-with-openssl-rand-base64-32",
  "your-secret-here",
]

export function isPlaceholderAuthSecret(secret: string): boolean {
  return PLACEHOLDER_SECRETS.includes(secret.trim().toLowerCase())
}

/**
 * Validate an environment source. Pure and deterministic so it can be unit
 * tested without touching `process.env`.
 */
export function parseEnv(source: EnvSource): EnvParseResult {
  const errors: string[] = []
  const warnings: string[] = []

  const isProduction = source.NODE_ENV === "production"
  const isDevMode = source.DEV_MODE === "true"

  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "(root)"
      errors.push(`${key}: ${issue.message}`)
    }
  }

  // Environment-aware required-ness.
  if (isProduction) {
    if (isDevMode) {
      // DEV_MODE bypasses auth entirely — never intended for production.
      warnings.push("DEV_MODE=true in production — authentication is bypassed; this is unsafe outside local dev")
    } else {
      if (!source.AUTH_SECRET) {
        errors.push("AUTH_SECRET: required in production (generate with `openssl rand -base64 32`)")
      } else if (isPlaceholderAuthSecret(source.AUTH_SECRET)) {
        // Session JWTs are signed with this; a published value lets anyone mint an admin session.
        errors.push("AUTH_SECRET: is a known placeholder — generate one with `openssl rand -base64 32`")
      } else if (source.AUTH_SECRET.length < 32) {
        // Warn rather than refuse: an existing deployment must not go down on upgrade.
        warnings.push("AUTH_SECRET is shorter than 32 characters — rotate it (`openssl rand -base64 32`)")
      }
      if (!source.RESEND_API_KEY) {
        warnings.push("RESEND_API_KEY not set — email verification and password reset are disabled")
      }
      if (!source.SITE_URL && !source.NEXT_PUBLIC_SITE_URL) {
        warnings.push("Neither SITE_URL nor NEXT_PUBLIC_SITE_URL is set — falling back to the hardcoded production origin")
      }
    }
  }

  return { success: errors.length === 0, errors, warnings }
}

/**
 * Validate `process.env` at boot. Logs warnings; throws on fatal errors so the
 * process exits instead of serving traffic with a broken configuration.
 */
export function validateEnv(source: EnvSource = process.env): EnvParseResult {
  const result = parseEnv(source)

  for (const warning of result.warnings) {
    console.warn(`[env] warning: ${warning}`)
  }

  if (!result.success) {
    const detail = result.errors.map((e) => `  - ${e}`).join("\n")
    throw new Error(
      `Invalid environment configuration — refusing to start:\n${detail}\n` +
        `See .env.example for the full list of variables.`
    )
  }

  return result
}
