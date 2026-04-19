-- AlterTable: add parentFamilyId to language_families for hierarchical family tree
ALTER TABLE "language_families" ADD COLUMN "parentFamilyId" TEXT;

-- CreateIndex
CREATE INDEX "language_families_parentFamilyId_idx" ON "language_families"("parentFamilyId");

-- AddForeignKey
ALTER TABLE "language_families" ADD CONSTRAINT "language_families_parentFamilyId_fkey" FOREIGN KEY ("parentFamilyId") REFERENCES "language_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;
