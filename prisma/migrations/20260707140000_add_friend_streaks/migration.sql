-- Shared streaks between mutual follows. Pair stored canonically (userAId < userBId).
CREATE TABLE "friend_streaks" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "longest" INTEGER NOT NULL DEFAULT 0,
    "lastBothDay" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friend_streaks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "friend_streaks_userAId_userBId_key" ON "friend_streaks"("userAId", "userBId");
CREATE INDEX "friend_streaks_userBId_idx" ON "friend_streaks"("userBId");

ALTER TABLE "friend_streaks" ADD CONSTRAINT "friend_streaks_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friend_streaks" ADD CONSTRAINT "friend_streaks_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce the canonical pair ordering in the DB so a reversed-order row can
-- never split one friendship's streak into two (app code always orders the pair,
-- but this makes it a structural guarantee, not a convention).
ALTER TABLE "friend_streaks" ADD CONSTRAINT "friend_streaks_canonical_order" CHECK ("userAId" < "userBId");
