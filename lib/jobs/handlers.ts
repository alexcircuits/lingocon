import { z } from "zod"

export type JobHandler = (payload: unknown) => Promise<void>

const registry = new Map<string, JobHandler>()

export function registerHandler(type: string, handler: JobHandler) {
  if (registry.has(type)) {
    throw new Error(`Job handler "${type}" is already registered`)
  }
  registry.set(type, handler)
}

export function getHandler(type: string): JobHandler | null {
  return registry.get(type) ?? null
}

// Test-only escape hatch so each test starts from a clean registry.
export function clearHandlers() {
  registry.clear()
}

// Builtins are registered explicitly by the worker entrypoint (not at import
// time) so tests control registry state.
export function registerBuiltinHandlers() {
  // No-op job that proves the enqueue → claim → run → complete pipeline
  // end-to-end, on a schedule, in production.
  registerHandler("heartbeat", async () => {})

  // Rematerialize inflected forms for every entry attached to a paradigm after
  // its rules (or a member entry) change. Kept out of module scope so the
  // heavy import only loads in the worker process.
  registerHandler("inflection_regen", async (payload) => {
    // Validate the untyped JSON payload at this trust boundary.
    const parsed = z.object({ paradigmId: z.string().min(1) }).safeParse(payload)
    if (!parsed.success) return
    const { regenerateParadigmForms } = await import("@/lib/services/inflection-service")
    await regenerateParadigmForms(parsed.data.paradigmId)
  })

  // Weekly: close finished league brackets, apply promotions/demotions, and
  // seed the new week's brackets. Idempotent, so a missed/duplicate run is safe.
  registerHandler("league_rollover", async () => {
    const { runLeagueRollover } = await import("@/lib/services/league-service")
    await runLeagueRollover()
  })
}
