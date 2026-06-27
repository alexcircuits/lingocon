const CACHE_NAME = "lingocon-v1"

// Assets to cache on install
const PRECACHE_ASSETS = [
    "/",
    "/dashboard",
    "/browse",
    "/login",
    "/manifest.json",
]

// Install: precache core shell
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS)
        })
    )
    self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        })
    )
    self.clients.claim()
})

// Fetch: network-first for API, stale-while-revalidate for pages
self.addEventListener("fetch", (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Skip non-GET requests
    if (request.method !== "GET") return

    // Skip auth and API routes (always fresh)
    if (url.pathname.startsWith("/api/auth")) return
    if (url.pathname.startsWith("/api/")) return

    // For navigation requests: network-first with cache fallback
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache successful page loads
                    if (response.ok) {
                        const clone = response.clone()
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, clone)
                        })
                    }
                    return response
                })
                .catch(() => {
                    // Offline: try cache
                    return caches.match(request).then((cached) => {
                        return cached || caches.match("/")
                    })
                })
        )
        return
    }

    // For static assets: cache-first
    if (
        url.pathname.startsWith("/icons/") ||
        url.pathname.startsWith("/fonts/") ||
        url.pathname.endsWith(".css") ||
        url.pathname.endsWith(".js")
    ) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone()
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, clone)
                        })
                    }
                    return response
                })
            })
        )
        return
    }

    // For dictionary/language data: stale-while-revalidate
    if (url.pathname.startsWith("/lang/") || url.pathname.startsWith("/studio/")) {
        event.respondWith(
            caches.match(request).then((cached) => {
                const fetchPromise = fetch(request)
                    .then((response) => {
                        if (response.ok) {
                            const clone = response.clone()
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, clone)
                            })
                        }
                        return response
                    })
                    .catch(() => cached)

                return cached || fetchPromise
            })
        )
        return
    }
})
