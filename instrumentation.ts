/**
 * Next.js instrumentation hook — runs once when the server process starts.
 *
 * We use it to validate environment configuration at boot so a misconfigured
 * deploy fails fast with a clear message instead of serving broken traffic.
 * Guarded to the Node.js runtime (skips the Edge runtime, where most server
 * env vars are unavailable and validation would be meaningless).
 *
 * Next 15 runs this without a config flag (Next 14 needed `experimental.instrumentationHook`).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/env")
    validateEnv()
  }
}
