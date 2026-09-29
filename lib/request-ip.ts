/**
 * Best-effort client IP for rate limiting behind the nginx proxy. nginx sets X-Real-IP from
 * $remote_addr and *appends* the peer to X-Forwarded-For, so the first XFF entry is whatever the
 * client sent — never key a limit on it.
 */
export function clientIpFromHeaders(headers: Pick<Headers, "get">): string {
  const realIp = headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",").at(-1)!.trim()
  return "unknown"
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
