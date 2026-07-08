import { prisma } from "@/lib/prisma"
import type { Prisma, Job } from "@prisma/client"
import { randomUUID } from "crypto"

/** A claimed job carries the lease token its worker must present to finalize it. */
export type ClaimedJob = Job & { leaseId: string }

export const MAX_ATTEMPTS = 3
export const RETRY_BACKOFF_MS = 5 * 60 * 1000
// Claims older than this are presumed dead-worker leftovers and become reclaimable.
export const STALE_CLAIM_MS = 15 * 60 * 1000
// Bounded so a hot race can't spin the poll loop; 5 losses in a row with a
// single-digit worker count means try again next poll tick.
const CLAIM_RACE_RETRIES = 5

export interface EnqueueOptions {
  runAfter?: Date
}

export async function enqueueJob(
  type: string,
  payload: Prisma.InputJsonObject = {},
  options: EnqueueOptions = {},
) {
  return prisma.job.create({
    data: { type, payload, runAfter: options.runAfter ?? new Date() },
  })
}

// Claim the oldest due job. The conditional updateMany IS the lock: if another
// worker claimed the candidate first, count is 0 and we try the next one.
// A job is claimable when it is due, has attempts left, is not finished, and
// either was never started or its claim went stale (dead worker). The
// finishedAt: null check is required so completed jobs (which keep startedAt
// set) are never reclaimed once their claim ages past STALE_CLAIM_MS.
export async function claimNextJob(now: Date = new Date()): Promise<ClaimedJob | null> {
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS)
  const claimable = {
    finishedAt: null,
    OR: [{ startedAt: null }, { startedAt: { lt: staleBefore } }],
  }
  for (let attempt = 0; attempt < CLAIM_RACE_RETRIES; attempt++) {
    const candidate = await prisma.job.findFirst({
      where: {
        ...claimable,
        runAfter: { lte: now },
        attempts: { lt: MAX_ATTEMPTS },
      },
      orderBy: { runAfter: "asc" },
    })
    if (!candidate) return null

    // Stamp a fresh lease on every claim. A later reclaim overwrites it, which
    // is what lets completeJob/failJob fence out the previous (slow) holder.
    const leaseId = randomUUID()
    const claimed = await prisma.job.updateMany({
      where: { id: candidate.id, ...claimable },
      data: { startedAt: now, attempts: { increment: 1 }, leaseId },
    })
    if (claimed.count === 1) return { ...candidate, leaseId }
  }
  return null
}

// Finalize a job ONLY if we still hold its lease. If the claim was reclaimed by
// another worker (which overwrote leaseId), this is a no-op — the reclaimer owns
// the job now and this stale worker must not mark it done.
export async function completeJob(id: string, leaseId: string) {
  await prisma.job.updateMany({
    where: { id, leaseId },
    data: { finishedAt: new Date(), error: null },
  })
}

// Failed jobs release the claim and back off linearly by attempt count — but
// only while they still hold the lease (same fencing as completeJob). Once
// attempts reach MAX_ATTEMPTS they are no longer claimable but stay in the
// table (finishedAt null, error set) for inspection.
export async function failJob(
  id: string,
  leaseId: string,
  error: unknown,
  now: Date = new Date(),
) {
  const message = error instanceof Error ? error.message : String(error)
  const job = await prisma.job.findUnique({ where: { id } })
  if (!job || job.leaseId !== leaseId) return
  await prisma.job.updateMany({
    where: { id, leaseId },
    data: {
      error: message.slice(0, 2000),
      startedAt: null,
      leaseId: null,
      runAfter: new Date(now.getTime() + RETRY_BACKOFF_MS * job.attempts),
    },
  })
}
