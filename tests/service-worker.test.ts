// @vitest-environment node
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { runInNewContext } from "node:vm"
import { describe, expect, it, vi } from "vitest"

function worker() {
  const handlers = new Map<string, (event: any) => void>()
  const stores = new Map<string, Map<string, Response>>()
  const key = (request: Request | string) => typeof request === "string"
    ? new URL(request, "https://example.com").href : request.url
  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map())
      const store = stores.get(name)!
      return {
        put: async (request: Request | string, response: Response) => { store.delete(key(request)); store.set(key(request), response.clone()) },
        match: async (request: Request | string) => store.get(key(request))?.clone(),
        keys: async () => [...store.keys()].map((url) => new Request(url)),
        delete: async (request: Request | string) => store.delete(key(request)),
        addAll: async (urls: string[]) => {
          for (const url of urls) store.set(key(url), new Response("You are offline", { headers: { "Content-Type": "text/html" } }))
        },
      }
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (request: Request | string) => {
      for (const store of stores.values()) {
        const response = store.get(key(request))
        if (response) return response.clone()
      }
    },
  }
  const fetch = vi.fn(async () => new Response("current", { headers: { "Content-Type": "text/x-component" } }))
  runInNewContext(readFileSync(resolve("public/sw.js"), "utf8"), {
    self: { location: { origin: "https://example.com" }, addEventListener: (name: string, handler: any) => handlers.set(name, handler), skipWaiting: vi.fn(), clients: { claim: vi.fn() } },
    caches, fetch, URL, Response,
  })
  async function lifecycle(name: string) {
    const pending: Promise<unknown>[] = []
    handlers.get(name)!({ waitUntil: (promise: Promise<unknown>) => pending.push(promise) })
    await Promise.all(pending)
  }
  async function request(path: string, options: { navigate?: boolean; headers?: Record<string, string> } = {}) {
    const request = new Request(new URL(path, "https://example.com"), { headers: options.headers })
    if (options.navigate) Object.defineProperty(request, "mode", { value: "navigate" })
    let response: Promise<Response> | undefined
    const pending: Promise<unknown>[] = []
    handlers.get("fetch")!({ request, respondWith: (result: Promise<Response>) => { response = result }, waitUntil: (p: Promise<unknown>) => pending.push(p) })
    const result = await (response ?? fetch(request))
    await Promise.all(pending)
    return result
  }
  return { caches, stores, fetch, request, lifecycle }
}

describe("service worker freshness", () => {
  it("never replays a cached studio RSC snapshot after a successful mutation", async () => {
    const sw = worker()
    const cache = await sw.caches.open("lingocon-v1")
    await cache.put("/studio/lang/test/dictionary?_rsc=abc", new Response("old dictionary"))
    expect(await (await sw.request("/studio/lang/test/dictionary?_rsc=abc", { headers: { RSC: "1" } })).text()).toBe("current")
  })

  it("passes navigations to the network unchanged, so server redirects reach the browser", async () => {
    const sw = worker()
    await sw.request("/studio/lang/old-slug/dictionary", { navigate: true })
    // Any init (e.g. { cache: "no-store" }) turns a navigate-mode request into a plain
    // same-origin fetch that follows redirects inside the worker: the browser then stays on
    // the old URL (a renamed project's old link lost its section this way).
    expect(sw.fetch).toHaveBeenCalledTimes(1)
    expect(sw.fetch.mock.calls[0]).toHaveLength(1)
  })

  it("never falls back to authenticated project HTML when offline", async () => {
    const sw = worker()
    await sw.lifecycle("install")
    const cache = await sw.caches.open("lingocon-v1")
    await cache.put("/studio/lang/test", new Response("obsolete private project"))
    sw.fetch.mockRejectedValue(new TypeError("offline"))
    const response = await sw.request("/studio/lang/test", { navigate: true })
    expect(await response.text()).not.toContain("obsolete private project")
    expect(response.headers.get("Content-Type")).toContain("text/html")
  })

  it("purges legacy project caches without deleting unrelated caches", async () => {
    const sw = worker()
    await sw.caches.open("lingocon-v1")
    await sw.caches.open("other-app")
    await sw.lifecycle("activate")
    expect(sw.stores.has("lingocon-v1")).toBe(false)
    expect(sw.stores.has("other-app")).toBe(true)
  })

  it("caches immutable chunks, but not HTML masquerading as JavaScript", async () => {
    const sw = worker()
    sw.fetch.mockResolvedValue(new Response("chunk", { headers: { "Content-Type": "application/javascript" } }))
    await sw.request("/_next/static/chunks/app-123.js")
    await sw.request("/_next/static/chunks/app-123.js")
    expect(sw.fetch).toHaveBeenCalledTimes(1)
    sw.fetch.mockResolvedValue(new Response("<html>login</html>", { headers: { "Content-Type": "text/html" } }))
    await sw.request("/_next/static/chunks/missing.js")
    await sw.request("/_next/static/chunks/missing.js")
    expect(sw.fetch).toHaveBeenCalledTimes(3)
  })

  it("does not persist mutable scripts or cross-origin assets", async () => {
    const sw = worker()
    sw.fetch.mockResolvedValue(new Response("script", { headers: { "Content-Type": "application/javascript" } }))
    await sw.request("/wasm/wasm_exec.js")
    await sw.request("/wasm/wasm_exec.js")
    await sw.request("https://third-party.example/widget.js")
    await sw.request("https://third-party.example/widget.js")
    expect(sw.fetch).toHaveBeenCalledTimes(4)
  })

  it("keeps the static cache bounded, evicting the oldest chunks but never the offline page", async () => {
    const sw = worker()
    await sw.lifecycle("install")
    sw.fetch.mockImplementation(async () => new Response("chunk", { headers: { "Content-Type": "application/javascript" } }))
    for (let i = 0; i < 405; i++) await sw.request(`/_next/static/chunks/c${i}.js`)
    const store = sw.stores.get("lingocon-static-v2")!
    const urls = [...store.keys()]
    expect(urls.length).toBeLessThanOrEqual(401) // 400 chunks + the offline page
    expect(urls).toContain("https://example.com/offline.html")
    expect(urls).toContain("https://example.com/_next/static/chunks/c404.js")
    expect(urls).not.toContain("https://example.com/_next/static/chunks/c0.js")
  })

  it("still downloads chunks and offers offline recovery when cache storage is unavailable", async () => {
    const sw = worker()
    vi.spyOn(sw.caches, "open").mockRejectedValue(new Error("Storage unavailable"))
    await sw.lifecycle("install")
    sw.fetch.mockResolvedValue(new Response("chunk", { headers: { "Content-Type": "application/javascript" } }))
    expect(await (await sw.request("/_next/static/chunks/app-123.js")).text()).toBe("chunk")
    sw.fetch.mockRejectedValue(new TypeError("offline"))
    expect(await (await sw.request("/studio/lang/test", { navigate: true })).text()).toContain("You are offline")
  })
})
