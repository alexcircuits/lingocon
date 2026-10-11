// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { send, constructed } = vi.hoisted(() => ({ send: vi.fn(), constructed: vi.fn() }))

vi.mock("resend", () => ({
  Resend: class {
    emails = { send }
    constructor(key?: string) {
      constructed(key)
      // Resend 6 refuses to construct without a key.
      if (!key) throw new Error("Missing API key. Pass it to the constructor `new Resend(\"re_123\")`")
    }
  },
}))

const originalKey = process.env.RESEND_API_KEY

async function load() {
  vi.resetModules()
  return import("@/lib/email")
}

beforeEach(() => {
  send.mockReset()
  constructed.mockReset()
})

afterEach(() => {
  if (originalKey === undefined) delete process.env.RESEND_API_KEY
  else process.env.RESEND_API_KEY = originalKey
  vi.restoreAllMocks()
})

describe("email", () => {
  it("loads and skips sending (logged, no throw) when RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const email = await load()

    await expect(email.sendVerificationEmail("someone@example.test", "token-1")).resolves.toBeUndefined()
    await expect(email.sendPasswordResetEmail("someone@example.test", "token-2")).resolves.toBeUndefined()
    expect(send).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledTimes(2)
    // The recipient's address is personal data: never in the log line.
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("someone@example.test")
  })

  it("sends through Resend when the key is set, creating the client once", async () => {
    process.env.RESEND_API_KEY = "re_test_key"
    const email = await load()

    await email.sendVerificationEmail("someone@example.test", "token-1")
    await email.sendPasswordResetEmail("someone@example.test", "token-2")
    expect(constructed).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0][0]).toMatchObject({ to: "someone@example.test", subject: expect.stringContaining("Verify") })
    expect(send.mock.calls[0][0].html).toContain("token-1")
    expect(send.mock.calls[1][0].html).toContain("token-2")
  })
})
