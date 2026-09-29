import { z } from "zod"

/**
 * Links users can set that are later rendered as <a href> for other people. `z.string().url()`
 * accepts `javascript:` and `data:` URLs, so every such field must use these instead.
 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/** Absolute http(s) URL. */
export const httpUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(isSafeHttpUrl, "Must be an http(s) URL")

/** Absolute http(s) URL or an in-app path like "/learn" (but not protocol-relative "//host"). */
export const httpUrlOrPathSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => isSafeHttpUrl(value) || (value.startsWith("/") && !value.startsWith("//")),
    "Must be an http(s) URL or a path starting with /"
  )

/**
 * Optional external link a user sets on their profile/language (Discord, Telegram, website).
 * "" clears it; a bare domain like "example.com" is upgraded to https:// rather than rejected, so
 * values saved before this validation existed keep working.
 */
export const optionalExternalLinkSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value
    const trimmed = value.trim()
    if (trimmed === "") return null
    if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && /^[^\s/]+\.[^\s]+$/.test(trimmed)) {
      return `https://${trimmed}`
    }
    return trimmed
  },
  httpUrlSchema.nullable().optional()
)

/**
 * A stored asset reference (flag image, custom font): our own `/uploads/...` path or an https URL.
 * The value ends up inside CSS `url(...)` and `<img src>`, so quotes, parentheses, backslashes and
 * whitespace are never allowed.
 */
export const assetUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      !/["'()\\\s<>]/.test(value) &&
      (/^\/uploads\/[A-Za-z0-9._\/-]+$/.test(value) || (isSafeHttpUrl(value) && value.startsWith("https://"))),
    "Must be an uploaded file or an https URL"
  )

/**
 * Image/file reference rendered as <img src> or a download link: our own `/uploads/...` path or an
 * http(s) URL. Looser than `assetUrlSchema` (http allowed) because it never lands in CSS.
 */
export const mediaUrlSchema = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (value) => !/["'<>\s]/.test(value) && (/^\/uploads\/[A-Za-z0-9._\/-]+$/.test(value) || isSafeHttpUrl(value)),
    "Must be an uploaded file or an http(s) URL"
  )
