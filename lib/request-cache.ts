import * as React from "react"

/**
 * React's per-request memoization (`cache`) where it exists — Next's server runtime ships a React
 * build that has it — and a pass-through everywhere else. The plain `react@18` package used by
 * vitest and the PM2 worker has no `cache` export, so importing it directly would crash them.
 */
type AnyFn = (...args: never[]) => unknown
const reactCache = (React as unknown as { cache?: <T extends AnyFn>(fn: T) => T }).cache

export function requestCache<T extends AnyFn>(fn: T): T {
  return reactCache ? reactCache(fn) : fn
}
