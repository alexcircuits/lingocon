import { describe, it, expect, vi } from "vitest"
import { z } from "zod"
import { toActionError, NotFoundError } from "../errors"

describe("toActionError", () => {
  it("passes through domain and validation messages", () => {
    expect(toActionError(new NotFoundError("Entry"), "x")).toEqual({ error: "Entry not found" })
    const zodError = z.object({ a: z.string().min(2, "Too short") }).safeParse({ a: "" }).error
    expect(toActionError(zodError, "x")).toEqual({ error: "Too short" })
  })

  it("never leaks unexpected error messages", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const leaky = new Error('Invalid `prisma.user.update()` invocation: column "password" ...')
    expect(toActionError(leaky, "Failed to update")).toEqual({ error: "Failed to update" })
    spy.mockRestore()
  })

  it("maps common Prisma error codes to friendly messages", () => {
    expect(toActionError({ code: "P2002" }, "x").error).toMatch(/already exists/)
    expect(toActionError({ code: "P2025" }, "x").error).toMatch(/Not found/)
  })
})
