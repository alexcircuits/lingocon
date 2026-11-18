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

  it("sends the email-change link to the new address", async () => {
    process.env.RESEND_API_KEY = "re_test_key"
    const email = await load()

    await email.sendEmailChangeConfirmation("new@example.test", "token-3")

    expect(send).toHaveBeenCalledTimes(1)
    const message = send.mock.calls[0][0]
    expect(message).toMatchObject({ to: "new@example.test", subject: expect.stringContaining("Confirm your new email") })
    expect(message.html).toContain("/confirm-email?token=token-3")
    expect(message.html).toContain("1 hour")
  })

  it("tells the old address which address replaced it, and what to do if that was not them", async () => {
    process.env.RESEND_API_KEY = "re_test_key"
    const email = await load()

    await email.sendEmailChangedNotice("old@example.test", "new@example.test")

    const message = send.mock.calls[0][0]
    expect(message).toMatchObject({ to: "old@example.test", subject: expect.stringContaining("email was changed") })
    expect(message.html).toContain("new@example.test")
    expect(message.html).toContain("/contact")
    // The notice is not a way back in: it carries no link that acts on the account.
    expect(message.html).not.toContain("token=")
  })

  it("escapes an address before putting it into the HTML of a notice", async () => {
    process.env.RESEND_API_KEY = "re_test_key"
    const email = await load()

    await email.sendEmailChangedNotice("old@example.test", "<b>x</b>@example.test")

    expect(send.mock.calls[0][0].html).not.toContain("<b>x</b>")
    expect(send.mock.calls[0][0].html).toContain("&lt;b&gt;x&lt;/b&gt;@example.test")
  })

  it("warns the current address when a change is requested, without a link that acts on the account", async () => {
    process.env.RESEND_API_KEY = "re_test_key"
    const email = await load()

    await email.sendEmailChangeRequestedNotice("old@example.test", "new@example.test")

    const message = send.mock.calls[0][0]
    expect(message).toMatchObject({ to: "old@example.test", subject: expect.stringContaining("requested") })
    expect(message.html).toContain("new@example.test")
    // What to do if it was not them: resetting the password cancels the request.
    expect(message.html).toContain("/forgot-password")
    expect(message.html).not.toContain("token=")
  })

  it("fails when the mail provider refuses an email-change message, instead of reporting it as sent", async () => {
    // Resend does not throw on API errors (unverified domain, rate limit): it returns { error }.
    process.env.RESEND_API_KEY = "re_test_key"
    send.mockResolvedValue({ data: null, error: { name: "rate_limit_exceeded", message: "Too many requests" } })
    const email = await load()

    await expect(email.sendEmailChangeConfirmation("new@example.test", "token-3")).rejects.toThrow("rate_limit_exceeded")
    // The address is personal data: not in the error that ends up in the server log.
    await expect(email.sendEmailChangeConfirmation("new@example.test", "token-3")).rejects.not.toThrow("new@example.test")
  })
})
