// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const TOKEN = "test-token-0123456789abcdef0123456789abcdef"
const URL_ENV = "http://127.0.0.1:3040/"

const analysis = {
  warnings: [
    { type: "undefined_symbol", message: 'Entry "ab" uses undefined symbols: b', severity: "warning" },
    { type: "missing_paradigm", message: 'Entry "c" references a missing paradigm', severity: "info" },
  ],
  total: 7,
  matchedIds: [1, 4, 9],
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

async function load() {
  // Fresh module state (the once-per-process warnings) for every test.
  vi.resetModules()
  return import("../lexicon-analysis")
}

const fetchMock = vi.fn<typeof fetch>()
let errorSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>

function loggedText(): string {
  return JSON.stringify([...errorSpy.mock.calls, ...warnSpy.mock.calls])
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("LINGOCON_API_URL", URL_ENV)
  vi.stubEnv("LINGOCON_API_TOKEN", TOKEN)
  vi.stubEnv("LINGOCON_API_TIMEOUT_MS", "")
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("getLexiconAnalysis", () => {
  it("returns null without fetching when the service is not configured", async () => {
    vi.stubEnv("LINGOCON_API_URL", "")
    vi.stubEnv("LINGOCON_API_TOKEN", "")
    const { getLexiconAnalysis } = await load()

    await expect(getLexiconAnalysis("lang-1")).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it("warns once and skips the request when only one variable is set", async () => {
    vi.stubEnv("LINGOCON_API_TOKEN", "")
    const { getLexiconAnalysis } = await load()

    await expect(getLexiconAnalysis("lang-1")).resolves.toBeNull()
    await expect(getLexiconAnalysis("lang-1")).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it("posts the language id with the bearer token and returns the parsed analysis", async () => {
    fetchMock.mockResolvedValue(jsonResponse(analysis))
    const { getLexiconAnalysis } = await load()

    await expect(getLexiconAnalysis("lang-1")).resolves.toEqual(analysis)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("http://127.0.0.1:3040/v1/internal/lexicon-analysis")
    expect(init?.method).toBe("POST")
    expect(init?.cache).toBe("no-store")
    expect(init?.redirect).toBe("error")
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(init?.headers).toMatchObject({
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    })
    expect(JSON.parse(String(init?.body))).toEqual({ languageId: "lang-1" })
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it.each([
    [404, { error: "language not found" }],
    [401, { error: "unauthorized" }],
    [503, { error: "database unavailable" }],
    [500, "plain text"],
  ])("returns null and logs once on HTTP %i", async (status, body) => {
    fetchMock.mockResolvedValue(
      typeof body === "string" ? new Response(body, { status }) : jsonResponse(body, status)
    )
    const { getLexiconAnalysis } = await load()

    await expect(getLexiconAnalysis("lang-1")).resolves.toBeNull()
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(String(errorSpy.mock.calls[0][0])).toContain(`HTTP ${status}`)
    expect(errorSpy.mock.calls[0][1]).toEqual({ languageId: "lang-1" })
    expect(loggedText()).not.toContain(TOKEN)
  })

  it("returns null when the request times out", async () => {
    vi.stubEnv("LINGOCON_API_TIMEOUT_MS", "20")
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))
        })
    )
    const { getLexiconAnalysis } = await load()

    await expect(getLexiconAnalysis("lang-1")).resolves.toBeNull()
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(String(errorSpy.mock.calls[0][0])).toContain("timed out after 20 ms")
  })

  it("returns null on network errors", async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } })
    )
    const { getLexiconAnalysis } = await load()

    await expect(getLexiconAnalysis("lang-1")).resolves.toBeNull()
    expect(String(errorSpy.mock.calls[0][0])).toContain("ECONNREFUSED")
    expect(loggedText()).not.toContain(TOKEN)
  })

  it("lets Next's dynamic-rendering bailout propagate", async () => {
    const bailout = Object.assign(new Error("no-store fetch"), { digest: "DYNAMIC_SERVER_USAGE" })
    fetchMock.mockRejectedValue(bailout)
    const { getLexiconAnalysis } = await load()

    await expect(getLexiconAnalysis("lang-1")).rejects.toBe(bailout)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it("returns null on invalid JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("{not json", { status: 200, headers: { "content-type": "application/json" } })
    )
    const { getLexiconAnalysis } = await load()

    await expect(getLexiconAnalysis("lang-1")).resolves.toBeNull()
    expect(String(errorSpy.mock.calls[0][0])).toContain("not valid JSON")
  })

  it.each([
    ["missing fields", { warnings: [] }],
    ["unknown warning type", { ...analysis, warnings: [{ ...analysis.warnings[0], type: "other" }] }],
    ["negative total", { ...analysis, total: -1 }],
    ["total below the returned warnings", { ...analysis, total: 1 }],
    ["fractional ids", { ...analysis, matchedIds: [1.5] }],
    [
      "more than 50 warnings",
      { ...analysis, total: 51, warnings: Array.from({ length: 51 }, () => analysis.warnings[0]) },
    ],
  ])("returns null for an invalid shape (%s)", async (_case, body) => {
    fetchMock.mockResolvedValue(jsonResponse(body))
    const { getLexiconAnalysis } = await load()

    await expect(getLexiconAnalysis("lang-1")).resolves.toBeNull()
    expect(String(errorSpy.mock.calls[0][0])).toContain("expected shape")
  })
})

describe("readRustApiConfig", () => {
  it("normalises the URL and applies the default timeout", async () => {
    const { readRustApiConfig } = await import("../config")
    expect(
      readRustApiConfig({ LINGOCON_API_URL: "http://127.0.0.1:3040//", LINGOCON_API_TOKEN: TOKEN })
    ).toEqual({ baseUrl: "http://127.0.0.1:3040", token: TOKEN, timeoutMs: 3_000 })
  })

  it("rejects unusable URLs and timeouts", async () => {
    vi.resetModules()
    const { readRustApiConfig } = await import("../config")
    expect(readRustApiConfig({ LINGOCON_API_URL: "not a url", LINGOCON_API_TOKEN: TOKEN })).toBeNull()
    expect(readRustApiConfig({ LINGOCON_API_URL: "ftp://host", LINGOCON_API_TOKEN: TOKEN })).toBeNull()
    for (const url of ["http://u:p@127.0.0.1:3040", "http://127.0.0.1:3040?x=1", "http://127.0.0.1:3040/#f"]) {
      expect(readRustApiConfig({ LINGOCON_API_URL: url, LINGOCON_API_TOKEN: TOKEN })).toBeNull()
    }
    expect(
      readRustApiConfig({
        LINGOCON_API_URL: "http://127.0.0.1:3040",
        LINGOCON_API_TOKEN: TOKEN,
        LINGOCON_API_TIMEOUT_MS: "soon",
      })?.timeoutMs
    ).toBe(3_000)
    expect(
      readRustApiConfig({
        LINGOCON_API_URL: "http://127.0.0.1:3040",
        LINGOCON_API_TOKEN: TOKEN,
        LINGOCON_API_TIMEOUT_MS: "1500",
      })?.timeoutMs
    ).toBe(1_500)
    expect(loggedText()).not.toContain(TOKEN)
  })
})
