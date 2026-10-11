import { createHash } from "node:crypto"

/**
 * Pure helpers for the anonymous statistics. A visitor is identified only by a hash of the day's
 * random salt, the IP and the User-Agent: neither the IP nor the User-Agent is stored, and once
 * the day's salt is deleted the hash can no longer be recomputed or linked to the next day.
 */

const BOT = /bot|crawl|spider|slurp|scrap|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|curl|wget|python-requests|httpclient|go-http|axios|node-fetch/i

export function isBot(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT.test(userAgent)
}

export type DeviceClass = "mobile" | "tablet" | "desktop"

export function deviceClass(userAgent: string): DeviceClass {
  if (/iPad|Tablet/i.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))) return "tablet"
  if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) return "mobile"
  return "desktop"
}

const stripWww = (host: string) => host.replace(/^www\./i, "").toLowerCase()

/** Host of an external http(s) referrer, or null (internal, missing or malformed). */
export function referrerHost(referrer: string | null | undefined, siteHost: string): string | null {
  if (!referrer) return null
  let url: URL
  try {
    url = new URL(referrer)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  const host = stripWww(url.hostname)
  if (!host || host === stripWww(siteHost.replace(/:\d+$/, ""))) return null
  return host.slice(0, 255)
}

export function visitorKey(salt: string, ip: string, userAgent: string): string {
  return createHash("sha256").update(`${salt}\n${ip}\n${userAgent}`).digest("hex").slice(0, 32)
}

/** Midnight UTC of the instant's calendar day. */
export function utcDay(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()))
}
