-- Weekly leagues: bracketed cohorts with promotion/demotion.

-- CreateTable
CREATE TABLE "leagues" (
    "id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_members" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leagues_weekStart_idx" ON "leagues"("weekStart");
CREATE INDEX "leagues_tier_weekStart_idx" ON "leagues"("tier", "weekStart");
CREATE INDEX "league_members_leagueId_idx" ON "league_members"("leagueId");
CREATE INDEX "league_members_weekStart_idx" ON "league_members"("weekStart");
CREATE UNIQUE INDEX "league_members_userId_weekStart_key" ON "league_members"("userId", "weekStart");

-- AddForeignKey
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
