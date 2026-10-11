// Mutable HTML and RSC payloads belong to Next's authenticated data lifecycle.
// A service-worker cache must never become a second source of project state.
const CACHE_NAME = "lingocon-static-v2"
const OFFLINE_URL = "/offline.html"
// Every deployment adds new content-addressed chunks; keep only the most recent ones.
const MAX_STATIC_ENTRIES = 400

async function trimStaticCache(cache) {
    const keys = await cache.keys()
    const chunks = keys.filter((request) => new URL(request.url).pathname !== OFFLINE_URL)
    const excess = chunks.length - MAX_STATIC_ENTRIES
    // Cache keys are returned in insertion order: drop the oldest first.
    for (let i = 0; i < excess; i++) await cache.delete(chunks[i])
}

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll([OFFLINE_URL]))
            .catch(() => {}) // Storage restrictions must not prevent the freshness fix activating.
            .then(() => self.skipWaiting())
    )
})

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => key.startsWith("lingocon-") && key !== CACHE_NAME)
                .map((key) => caches.delete(key))
        )).catch(() => {}).then(() => self.clients.claim())
    )
})

self.addEventListener("fetch", (event) => {
    const { request } = event
    const url = new URL(request.url)
    if (request.method !== "GET" || url.origin !== self.location.origin) return

    // RSC, prefetches, APIs and all other mutable resources go straight to the
    // network. Never replace a failed RSC fetch with an HTML offline document.
    if (request.headers.get("RSC") === "1" || request.headers.get("Accept")?.includes("text/x-component")) return

    if (request.mode === "navigate") {
        // The request as is: any init turns it into a plain fetch that follows redirects
        // here, leaving the browser on the old URL (e.g. a renamed project's old link).
        // Pages are no-store already, so the HTTP cache is not in the way.
        event.respondWith(fetch(request).catch(async () => {
            const offline = await caches.open(CACHE_NAME).then(cache => cache.match(OFFLINE_URL)).catch(() => undefined)
            return offline || new Response(
                "<!doctype html><h1>You are offline</h1><p>Reconnect to load your current project.</p>",
                { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
            )
        }))
        return
    }

    // Next-generated URLs are content-addressed. Unversioned scripts (including
    // wasm_exec.js), uploads and third-party assets must not be cached here.
    if (!url.pathname.startsWith("/_next/static/")) return
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME).catch(() => undefined)
        const cached = await cache?.match(request).catch(() => undefined)
        if (cached) return cached
        const response = await fetch(request)
        const contentType = response.headers.get("Content-Type") || ""
        const cacheControl = response.headers.get("Cache-Control") || ""
        if (cache && response.ok && !response.redirected && !/text\/html|text\/x-component/i.test(contentType)
            && !/no-store|private/i.test(cacheControl)) {
            // Keep the worker alive for cache writes; storage failure should not
            // turn a successfully downloaded chunk into a blank page.
            event.waitUntil(cache.put(request, response.clone()).then(() => trimStaticCache(cache)).catch(() => {}))
        }
        return response
    })())
})
