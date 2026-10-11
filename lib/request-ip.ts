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

/**
 * Rate-limit bucket for an address. An IPv6 client usually gets a whole /64, so keying on the full
 * address would let it rotate through 2^64 buckets.
 */
export function ipRateLimitKey(ip: string): string {
  if (!ip.includes(":")) return ip
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip)
  if (mapped) return mapped[1]
  const [head, tail] = ip.toLowerCase().split("::")
  const headGroups = head ? head.split(":") : []
  const tailGroups = tail ? tail.split(":") : []
  const zeros = tail === undefined ? [] : Array(Math.max(8 - headGroups.length - tailGroups.length, 0)).fill("0")
  const groups = [...headGroups, ...zeros, ...tailGroups].map((group) => group.replace(/^0+(?=.)/, ""))
  return `${groups.slice(0, 4).join(":")}::/64`
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
