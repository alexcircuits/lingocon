import { describe, expect, it, vi } from "vitest"
import { OPEN_COLLECTIVE_API_URL } from "../constants"
import { TOP_BACKERS_QUERY, fetchTopBackers } from "../fetch-backers"
import { member, payload } from "./fixtures"

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" }, ...init })
}

function fetchReturning(response: Response) {
  return vi.fn<typeof fetch>(async () => response)
}

const options = { slug: "lingocon", limit: 12 }

describe("fetchTopBackers", () => {
  it("POSTs the backers query for the collective to the GraphQL v2 endpoint", async () => {
    const fetchImpl = fetchReturning(jsonResponse(payload([member(6400)])))

    await fetchTopBackers({ ...options, fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(OPEN_COLLECTIVE_API_URL)
    expect(init?.method).toBe("POST")
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json")
    expect(init?.signal).toBeInstanceOf(AbortSignal)

    const body = JSON.parse(String(init?.body))
    expect(body.query).toBe(TOP_BACKERS_QUERY)
    expect(body.variables.slug).toBe("lingocon")
    expect(body.variables.limit).toBeGreaterThanOrEqual(12)
  })

  it("sends no credentials or cookies — the data is public", async () => {
    const fetchImpl = fetchReturning(jsonResponse(payload([])))

    await fetchTopBackers({ ...options, fetchImpl })

    const init = fetchImpl.mock.calls[0][1]
    const headers = new Headers(init?.headers)
    expect(headers.has("Authorization")).toBe(false)
    expect(headers.has("Personal-Token")).toBe(false)
    expect(headers.has("Cookie")).toBe(false)
  })

  it("asks only for backers, sorted by total contributed, and never for private fields", () => {
    expect(TOP_BACKERS_QUERY).toMatch(/role:\s*\[BACKER\]/)
    expect(TOP_BACKERS_QUERY).toMatch(/orderByTotalContributed:\s*DESC/)
    expect(TOP_BACKERS_QUERY).toMatch(/isIncognito/)
    expect(TOP_BACKERS_QUERY).not.toMatch(/email|legalName|location|address/i)
  })

  it("returns the parsed, sorted backers", async () => {
    const fetchImpl = fetchReturning(
      jsonResponse(payload([member(1000, { id: "a", slug: "a", name: "A" }), member(6400, { id: "b", slug: "b", name: "B" })])),
    )

    const result = await fetchTopBackers({ ...options, fetchImpl })

    expect(result.currency).toBe("EUR")
    expect(result.backers.map((b) => b.name)).toEqual(["B", "A"])
  })

  it("respects the display limit", async () => {
    const nodes = Array.from({ length: 5 }, (_, i) => member(100 + i, { id: `a${i}`, slug: `s${i}` }))
    const fetchImpl = fetchReturning(jsonResponse(payload(nodes)))

    const result = await fetchTopBackers({ slug: "lingocon", limit: 2, fetchImpl })

    expect(result.backers).toHaveLength(2)
  })

  it.each([429, 500, 503])("rejects on HTTP %i", async (status) => {
    const fetchImpl = fetchReturning(jsonResponse({ error: "nope" }, { status }))

    await expect(fetchTopBackers({ ...options, fetchImpl })).rejects.toThrow(String(status))
  })

  it("rejects when GraphQL reports errors, even with HTTP 200", async () => {
    const fetchImpl = fetchReturning(jsonResponse({ errors: [{ message: "Cannot query field" }], data: null }))

    await expect(fetchTopBackers({ ...options, fetchImpl })).rejects.toThrow(/Cannot query field/)
  })

  it("rejects when the body is not JSON", async () => {
    const fetchImpl = fetchReturning(new Response("<html>Bad gateway</html>", { status: 200 }))

    await expect(fetchTopBackers({ ...options, fetchImpl })).rejects.toThrow()
  })

  it("rejects when the collective does not exist", async () => {
    const fetchImpl = fetchReturning(jsonResponse({ data: { account: null } }))

    await expect(fetchTopBackers({ ...options, fetchImpl })).rejects.toThrow()
  })

  it("rejects when members came back but none was usable, rather than reporting an empty collective", async () => {
    const fetchImpl = fetchReturning(jsonResponse(payload([{ unexpected: "shape" }, null])))

    await expect(fetchTopBackers({ ...options, fetchImpl })).rejects.toThrow(/none of the 2 members/i)
  })

  it("resolves with an empty list for a collective that really has no backers", async () => {
    const fetchImpl = fetchReturning(jsonResponse(payload([])))

    await expect(fetchTopBackers({ ...options, fetchImpl })).resolves.toMatchObject({ backers: [], skipped: 0 })
  })

  it("rejects when the network fails", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed")
    })

    await expect(fetchTopBackers({ ...options, fetchImpl })).rejects.toThrow("fetch failed")
  })

  it("gives up on a response that takes longer than the timeout", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))
        }),
    )

    await expect(fetchTopBackers({ ...options, fetchImpl, timeoutMs: 20 })).rejects.toMatchObject({
      name: "TimeoutError",
    })
  })
})
