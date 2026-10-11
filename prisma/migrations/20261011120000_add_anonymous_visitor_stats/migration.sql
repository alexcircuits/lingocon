-- Anonymous visitor statistics (lib/stats). Additive only: four new tables, no change to
-- existing data. No IPs, cookies or user ids are stored; see prisma/schema.prisma.

-- CreateTable
CREATE TABLE "stats_salts" (
    "day" DATE NOT NULL,
    "salt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stats_salts_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "stats_presence" (
    "visitorKey" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "signedIn" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stats_presence_pkey" PRIMARY KEY ("visitorKey")
);

-- CreateTable
CREATE TABLE "stats_page_views" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "path" TEXT NOT NULL,
    "languageSlug" TEXT,
    "visitorKey" TEXT NOT NULL,
    "signedIn" BOOLEAN NOT NULL DEFAULT false,
    "referrer" TEXT,
    "device" TEXT NOT NULL,

    CONSTRAINT "stats_page_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stats_daily" (
    "day" DATE NOT NULL,
    "pageViews" INTEGER NOT NULL,
    "visitors" INTEGER NOT NULL,
    "signedInVisitors" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stats_daily_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE INDEX "stats_page_views_createdAt_idx" ON "stats_page_views"("createdAt");

