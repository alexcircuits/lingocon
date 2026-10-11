// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { RAW_RETENTION_DAYS } from "../store"
import { PING_INTERVAL_MS } from "@/components/visit-stats"
import { COOKIE_NOTICE_KEY } from "@/components/cookie-notice"

// The /cookies page describes what the code does; keep the two from drifting apart.
describe("the cookies & statistics page", () => {
  const en = JSON.parse(readFileSync(path.join(process.cwd(), "messages/en.json"), "utf8")).cookies.page
  const page = readFileSync(path.join(process.cwd(), "app/cookies/page.tsx"), "utf8")

  it("states the real retention and ping interval", () => {
    expect(en.statsRetention).toContain(`${RAW_RETENTION_DAYS} days`)
    expect(en.statsIntro).toContain(`${PING_INTERVAL_MS / 1000} seconds`)
  })

  it("lists the cookie notice's own storage key", () => {
    expect(page).toContain(`"${COOKIE_NOTICE_KEY}"`)
  })
})
