// Background worker: polls the Job queue and runs cron schedules.
// Runs as the single-instance PM2 app "lingocon-worker" (see ecosystem.config.js).
// `tsx scripts/worker.ts --once` enqueues a heartbeat, drains the queue, and
// exits — used as a smoke test in dev and on the server.
//
// NOTE on claim leases: lib/jobs/queue.ts reclaims claims older than
// STALE_CLAIM_MS (15 min). Handlers must therefore finish well under 15
// minutes — long-running work should be split into batched jobs. There is no
// lease fencing yet; a handler that outlives its lease could race a reclaimer.
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
    await failJob(job.id, new Error(`No handler registered for job type "${job.type}"`))
    return true
  }

  try {
    await handler(job.payload)
    await completeJob(job.id)
    console.log(`[worker] completed ${job.type} (${job.id})`)
  } catch (error) {
    await failJob(job.id, error)
    console.error(`[worker] failed ${job.type} (${job.id}):`, error)
  }
  return true
}

async function drain() {
  while (await processOne()) {
    // keep going until the queue is empty
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
