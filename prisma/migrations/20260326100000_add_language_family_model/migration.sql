-- CreateTable
CREATE TABLE "language_families" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "language_families_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "language_families_slug_key" ON "language_families"("slug");

-- CreateIndex
CREATE INDEX "language_families_ownerId_idx" ON "language_families"("ownerId");

-- CreateIndex
CREATE INDEX "language_families_slug_idx" ON "language_families"("slug");

-- AddForeignKey
ALTER TABLE "language_families" ADD CONSTRAINT "language_families_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add familyId to languages
ALTER TABLE "languages" ADD COLUMN "familyId" TEXT;

-- CreateIndex
CREATE INDEX "languages_familyId_idx" ON "languages"("familyId");

-- AddForeignKey
ALTER TABLE "languages" ADD CONSTRAINT "languages_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "language_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;
