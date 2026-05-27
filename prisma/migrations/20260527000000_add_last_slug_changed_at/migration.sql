-- AlterTable
ALTER TABLE "languages" ADD COLUMN IF NOT EXISTS "lastSlugChangedAt" TIMESTAMP(3);
