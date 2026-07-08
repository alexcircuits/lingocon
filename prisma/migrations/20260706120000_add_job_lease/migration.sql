-- Fencing token for the background job queue. Set on each claim; completeJob
-- and failJob only act while they still hold the current lease, so a slow
-- worker whose claim was reclaimed after STALE_CLAIM_MS cannot finalize a job
-- the new worker now owns (prevents double-finalization on overrun).
ALTER TABLE "jobs" ADD COLUMN "leaseId" TEXT;
