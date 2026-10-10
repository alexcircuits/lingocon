/**
 * Recovery from deployment version skew.
 *
 * After a deploy, a tab that loaded the previous build may request a code-split
 * chunk (a lazily loaded dialog, editor, route) whose hashed file no longer
 * exists. React cannot retry a rejected module import, and `reset()` from an
 * error boundary hits the same missing file again, so the only recovery is to
 * load the document from the current build.
 */
const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk [^\s]+ failed|Loading CSS chunk|CSS_CHUNK_LOAD_FAILED|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

const RELOAD_MARKER_KEY = "lingocon:chunk-reload-at"
/** Do not reload again within this window: a second failure means the asset is really gone. */
const RELOAD_GUARD_MS = 30_000

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  if (typeof error === "string") return CHUNK_ERROR_PATTERN.test(error)
  if (typeof error === "object") {
    const { name, message } = error as { name?: unknown; message?: unknown }
    return CHUNK_ERROR_PATTERN.test(`${String(name ?? "")} ${String(message ?? "")}`)
  }
  return false
}

function readMarker(): number {
  try {
    return Number(window.sessionStorage.getItem(RELOAD_MARKER_KEY)) || 0
  } catch {
    return 0
  }
}

function writeMarker(value: number): void {
  try {
    window.sessionStorage.setItem(RELOAD_MARKER_KEY, String(value))
  } catch {
    // Storage may be unavailable (private mode); the guard then only limits this page load.
  }
}

/**
 * Reload the document once to pick up the current build. Returns false (and does
 * nothing) if a chunk-recovery reload already happened recently, so a genuinely
 * missing asset shows the error UI instead of a reload loop.
 */
export function reloadOnceForChunkError(now: number = Date.now()): boolean {
  if (typeof window === "undefined") return false
  // Offline, the chunk is unreachable rather than stale: a reload would only swap the
  // page (and any unsaved work) for the offline page. The error UI offers a retry.
  if (!window.navigator.onLine) return false
  if (now - readMarker() < RELOAD_GUARD_MS) return false
  writeMarker(now)
  window.location.reload()
  return true
}
