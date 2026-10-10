const fs = require("fs")
const path = require("path")

/** File recording the release directory `next start` serves (written by deploy.sh). */
const RELEASE_POINTER = ".next-release"

/**
 * Which build directory Next uses, for next.config.js.
 *
 * deploy.sh builds every release into its own directory (NEXT_DIST_DIR during the
 * build) and records the active one in `.next-release`; `next start` serves that
 * directory, so a plain PM2 reload moves each worker to the new release without
 * touching the process environment.
 *
 * A manual `npm run build` / `next build` (no NEXT_DIST_DIR) writes `.next`, and
 * that build must become the served one: otherwise the usual `pm2 reload` would
 * keep serving whatever older release the pointer names. So it drops the pointer —
 * but only when the build succeeds: a failed manual build must not leave the next
 * worker restart (crash, reboot, `pm2 reload`) serving a half-written `.next` while
 * the release the workers run is intact.
 *
 * @param {{ root: string, argv: string[], env: Record<string, string | undefined>, onExit?: (listener: (code: number) => void) => void }} options
 * @returns {string}
 */
function resolveDistDir({ root, argv, env, onExit = (listener) => process.once("exit", listener) }) {
  if (env.NEXT_DIST_DIR) return env.NEXT_DIST_DIR
  const pointer = path.join(root, RELEASE_POINTER)
  if (argv.includes("build")) {
    onExit((code) => {
      if (code === 0) fs.rmSync(pointer, { force: true })
    })
    return ".next"
  }
  if (argv.includes("start")) {
    try {
      const release = fs.readFileSync(pointer, "utf8").trim()
      if (release) return release
    } catch {
      // No release file (no deploy.sh release yet, local runs): default below.
    }
  }
  return ".next"
}

module.exports = { resolveDistDir, RELEASE_POINTER }
