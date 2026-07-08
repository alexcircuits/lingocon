// Background worker: polls the Job queue and runs cron schedules.
// Runs as the single-instance PM2 app "lingocon-worker" (see ecosystem.config.js).
// `tsx scripts/worker.ts --once` enqueues a heartbeat, drains the queue, and
// exits — used as a smoke test in dev and on the server.
//
// NOTE on claim leases: lib/jobs/queue.ts reclaims claims older than
// STALE_CLAIM_MS (15 min). Handlers should still finish well under 15 minutes
// — long-running work should be split into batched jobs — but claims are now
// lease-fenced: if a slow handler outlives its lease and the job is reclaimed,
// the slow worker's completeJob/failJob become no-ops (the reclaimer owns it).
// Fencing protects the queue's bookkeeping; handlers should also be idempotent
// since the work itself can still run twice on an overrun.
import "dotenv/config"
import cron from "node-cron"
import { claimNextJob, completeJob, failJob, enqueueJob } from "../lib/jobs/queue"
import { getHandler, registerBuiltinHandlers } from "../lib/jobs/handlers"
import { prisma } from "../lib/prisma"

const POLL_INTERVAL_MS = 5000
let shuttingDown = false

async function processOne(): Promise<boolean> {
  const job = await claimNextJob()
  if (!job) return false

  const handler = getHandler(job.type)
  if (!handler) {
    await failJob(job.id, job.leaseId, new Error(`No handler registered for job type "${job.type}"`))
    return true
  }

  try {
    await handler(job.payload)
    await completeJob(job.id, job.leaseId)
    console.log(`[worker] completed ${job.type} (${job.id})`)
  } catch (error) {
    await failJob(job.id, job.leaseId, error)
    console.error(`[worker] failed ${job.type} (${job.id}):`, error)
  }
  return true
}

async function drain() {
  while (!shuttingDown && (await processOne())) {
    // keep going until the queue is empty (or we're asked to stop)
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  registerBuiltinHandlers()

  if (process.argv.includes("--once")) {
    await enqueueJob("heartbeat")
    await drain()
    await prisma.$disconnect()
    console.log("[worker] --once run complete")
    return
  }

  // Hourly heartbeat proves the pipeline is alive in production.
  cron.schedule("0 * * * *", () => {
    void enqueueJob("heartbeat")
  })

  // Weekly league rollover — Monday 00:05 UTC, just after the week boundary.
  // The handler is idempotent, so an occasional double-fire is harmless.
  cron.schedule("5 0 * * 1", () => {
    void enqueueJob("league_rollover")
  }, { timezone: "UTC" })

  process.on("SIGINT", () => { shuttingDown = true })
  process.on("SIGTERM", () => { shuttingDown = true })

  console.log("[worker] started, polling every 5s")
  while (!shuttingDown) {
    try {
      await drain()
    } catch (error) {
      console.error("[worker] poll loop error:", error)
    }
    await sleep(POLL_INTERVAL_MS)
  }
  await prisma.$disconnect()
  console.log("[worker] shut down cleanly")
}

void main()
