/**
 * Calendar days in UTC for the admin charts. Server-local dates made the buckets and their labels
 * depend on the host's time zone (a day could be labelled with its neighbour); UTC is the same on
 * every machine and matches the database's day buckets.
 */

const DAY_MS = 86_400_000

/** `YYYY-MM-DD` of the last `days` UTC days, oldest first, today included. */
export function lastUtcDays(days: number, now: Date = new Date()): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Array.from({ length: days }, (_, i) => new Date(today - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10))
}

/** "Oct 11" for `2026-10-11`. */
export function utcDayLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}
