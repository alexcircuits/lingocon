-- CreateEnum
CREATE TYPE "FamilyType" AS ENUM ('SYSTEM', 'USER');

-- AlterTable: add type column with default USER
ALTER TABLE "language_families" ADD COLUMN "type" "FamilyType" NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE INDEX "language_families_type_idx" ON "language_families"("type");
