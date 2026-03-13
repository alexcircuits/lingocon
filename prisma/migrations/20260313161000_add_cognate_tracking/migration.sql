-- AlterTable
ALTER TABLE "dictionary_entries" ADD COLUMN "sourceEntryId" TEXT;

-- CreateIndex
CREATE INDEX "dictionary_entries_sourceEntryId_idx" ON "dictionary_entries"("sourceEntryId");

-- AddForeignKey
ALTER TABLE "dictionary_entries" ADD CONSTRAINT "dictionary_entries_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "dictionary_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
