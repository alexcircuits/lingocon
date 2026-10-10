// @vitest-environment node
import { mkdtempSync, existsSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveDistDir, RELEASE_POINTER } = require("../lib/release-dir.cjs") as {
  resolveDistDir: (options: {
    root: string
    argv: string[]
    env: Record<string, string | undefined>
    onExit?: (listener: (code: number) => void) => void
  }) => string
  RELEASE_POINTER: string
}

let root: string
const pointer = () => path.join(root, RELEASE_POINTER)
const next = (command: string) => ["/usr/bin/node", "/app/node_modules/next/dist/bin/next", command]

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "release-dir-"))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe("resolveDistDir", () => {
  it("serves the release deploy.sh activated", () => {
    writeFileSync(pointer(), ".next-releases/20261010080000\n")
    expect(resolveDistDir({ root, argv: next("start"), env: {} })).toBe(".next-releases/20261010080000")
  })

  it("serves .next when no release was ever activated (today's production)", () => {
    expect(resolveDistDir({ root, argv: next("start"), env: {} })).toBe(".next")
  })

  it("builds a deploy.sh release where NEXT_DIST_DIR says, leaving the active pointer alone", () => {
    writeFileSync(pointer(), ".next-releases/old\n")
    expect(resolveDistDir({ root, argv: next("build"), env: { NEXT_DIST_DIR: ".next-releases/new" } })).toBe(".next-releases/new")
    expect(existsSync(pointer())).toBe(true)
  })

  it("makes a successful manual `npm run build` the served build again (no stale release after `pm2 reload`)", () => {
    writeFileSync(pointer(), ".next-releases/old\n")
    let onBuildExit: (code: number) => void = () => {}
    expect(resolveDistDir({ root, argv: next("build"), env: {}, onExit: (listener) => (onBuildExit = listener) })).toBe(".next")
    // The release keeps being the served one while the build runs.
    expect(resolveDistDir({ root, argv: next("start"), env: {} })).toBe(".next-releases/old")
    onBuildExit(0)
    expect(existsSync(pointer())).toBe(false)
    expect(resolveDistDir({ root, argv: next("start"), env: {} })).toBe(".next")
  })

  it("keeps serving the release when a manual build fails (half-written .next)", () => {
    writeFileSync(pointer(), ".next-releases/old\n")
    let onBuildExit: (code: number) => void = () => {}
    resolveDistDir({ root, argv: next("build"), env: {}, onExit: (listener) => (onBuildExit = listener) })
    onBuildExit(1)
    expect(resolveDistDir({ root, argv: next("start"), env: {} })).toBe(".next-releases/old")
  })

  it("ignores the pointer in dev and for an empty pointer file", () => {
    writeFileSync(pointer(), ".next-releases/old\n")
    expect(resolveDistDir({ root, argv: next("dev"), env: {} })).toBe(".next")
    writeFileSync(pointer(), "  \n")
    expect(resolveDistDir({ root, argv: next("start"), env: {} })).toBe(".next")
  })
})
