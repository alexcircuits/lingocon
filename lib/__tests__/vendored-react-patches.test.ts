// @vitest-environment node
/**
 * The App Router runs on the React that Next vendors (next/dist/compiled/react-dom), not on the
 * react-dom package. patches/next+15.5.27.patch backports two React fixes into it; this checks
 * they are in place (a Next bump or a skipped postinstall would silently ship without them).
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const DIR = path.join(process.cwd(), "node_modules/next/dist/compiled/react-dom/cjs")
const BUILDS = [
  "react-dom-client.production.js",
  "react-dom-client.development.js",
  "react-dom-profiling.profiling.js",
  "react-dom-profiling.development.js",
]

function fn(source: string, name: string, next: string): string {
  const start = source.indexOf(`function ${name}(`)
  const end = source.indexOf(`function ${next}`, start)
  expect(start, `${name} not found`).toBeGreaterThan(-1)
  return source.slice(start, end)
}

describe.each(BUILDS)("vendored React %s", (build) => {
  const source = readFileSync(path.join(DIR, build), "utf8")

  it("replays a suspended host component from its own DOM node while hydrating", () => {
    // Without it, a slow client chunk made React report #418 and duplicate the page content.
    expect(fn(source, "replaySuspendedUnitOfWork", "throwAndUnwindWorkLoop")).toContain("(nextHydratableInstance = fiber.stateNode)")
  })

  it("keeps a ping that arrives during render while suspended with delay", () => {
    // Without it, a router transition (refresh, navigation, action redirect) whose RSC response
    // streamed in slowly could stay suspended forever: the page never updated.
    const body = fn(source, "pingSuspendedRoot", "retryTimedOutBoundary")
    expect(body).toMatch(/\?\s*prepareFreshStack\(root, 0\)\s*:\s*\(workInProgressRootPingedLanes \|= pingedLanes\)/)
    expect(body).not.toMatch(/&&\s*prepareFreshStack\(root, 0\)/)
  })
})
