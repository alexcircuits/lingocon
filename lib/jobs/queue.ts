import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export const MAX_ATTEMPTS = 3
export const RETRY_BACKOFF_MS = 5 * 60 * 1000
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
export async function claimNextJob(now: Date = new Date()) {
  for (let attempt = 0; attempt < CLAIM_RACE_RETRIES; attempt++) {
    const candidate = await prisma.job.findFirst({
      where: {
        startedAt: null,
        runAfter: { lte: now },
        attempts: { lt: MAX_ATTEMPTS },
      },
      orderBy: { runAfter: "asc" },
    })
    if (!candidate) return null

    const claimed = await prisma.job.updateMany({
      where: { id: candidate.id, startedAt: null },
      data: { startedAt: now, attempts: { increment: 1 } },
    })
    if (claimed.count === 1) return candidate
  }
  return null
}

export async function completeJob(id: string) {
  await prisma.job.update({
    where: { id },
    data: { finishedAt: new Date(), error: null },
  })
}

// Failed jobs release the claim and back off linearly by attempt count. Once
// attempts reach MAX_ATTEMPTS they are no longer claimable but stay in the
// table (finishedAt null, error set) for inspection.
export async function failJob(id: string, error: unknown, now: Date = new Date()) {
  const message = error instanceof Error ? error.message : String(error)
  const job = await prisma.job.findUnique({ where: { id } })
  if (!job) return
  await prisma.job.update({
    where: { id },
    data: {
      error: message.slice(0, 2000),
      startedAt: null,
      runAfter: new Date(now.getTime() + RETRY_BACKOFF_MS * job.attempts),
    },
  })
}
