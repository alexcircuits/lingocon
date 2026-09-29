import { describe, it, expect } from "vitest"
import { parseEnv, validateEnv } from "@/lib/env"

const base = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/langua?schema=public",
  AUTH_SECRET: "a-very-long-secret-value-for-tests",
}

describe("parseEnv", () => {
  it("passes with a valid production config", () => {
    const result = parseEnv(base)
    expect(result.success).toBe(true)
    expect(result.errors).toEqual([])
  })

  it("fails fast when DATABASE_URL is missing", () => {
    const { DATABASE_URL, ...rest } = base
    const result = parseEnv(rest)
    expect(result.success).toBe(false)
    expect(result.errors.some((e) => e.includes("DATABASE_URL"))).toBe(true)
  })

  it("requires AUTH_SECRET in production", () => {
    const { AUTH_SECRET, ...rest } = base
    const result = parseEnv(rest)
    expect(result.success).toBe(false)
    expect(result.errors.some((e) => e.includes("AUTH_SECRET"))).toBe(true)
  })

  it("does not require AUTH_SECRET in production when DEV_MODE=true", () => {
    const { AUTH_SECRET, ...rest } = base
    const result = parseEnv({ ...rest, DEV_MODE: "true" })
    expect(result.errors.some((e) => e.includes("AUTH_SECRET"))).toBe(false)
  })

  it("does not require AUTH_SECRET in development", () => {
    const { AUTH_SECRET, ...rest } = base
    const result = parseEnv({ ...rest, NODE_ENV: "development" })
    expect(result.success).toBe(true)
  })

  it("rejects a malformed URL", () => {
    const result = parseEnv({ ...base, SITE_URL: "not-a-url" })
    expect(result.success).toBe(false)
    expect(result.errors.some((e) => e.includes("SITE_URL"))).toBe(true)
  })

  it("warns (not errors) when RESEND_API_KEY is missing in production", () => {
    const result = parseEnv(base)
    expect(result.success).toBe(true)
    expect(result.warnings.some((w) => w.includes("RESEND_API_KEY"))).toBe(true)
  })

  it("warns when DEV_MODE=true in production", () => {
    const result = parseEnv({ ...base, DEV_MODE: "true" })
    expect(result.warnings.some((w) => w.includes("DEV_MODE"))).toBe(true)
  })
})

describe("validateEnv", () => {
  it("throws on a fatal misconfiguration", () => {
    expect(() => validateEnv({ NODE_ENV: "production" })).toThrow(/Invalid environment configuration/)
  })

  it("returns the result on success", () => {
    const result = validateEnv(base)
    expect(result.success).toBe(true)
  })
})

describe("AUTH_SECRET strength", () => {
  it("rejects the old docker-compose placeholder in production", () => {
    const result = parseEnv({ ...base, AUTH_SECRET: "change-me-in-production" })
    expect(result.success).toBe(false)
    expect(result.errors.some((e) => e.includes("AUTH_SECRET"))).toBe(true)
  })

  it("only warns about short secrets so existing deployments keep booting", () => {
    const result = parseEnv({ ...base, AUTH_SECRET: "short-but-real" })
    expect(result.success).toBe(true)
    expect(result.warnings.some((w) => w.includes("AUTH_SECRET"))).toBe(true)
  })
})
