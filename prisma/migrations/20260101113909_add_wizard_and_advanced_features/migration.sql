-- AlterTable
ALTER TABLE "dictionary_entries" ADD COLUMN     "paradigmId" TEXT;

-- AlterTable
ALTER TABLE "languages" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "script_symbols" ADD COLUMN     "latin" TEXT;

-- CreateTable
CREATE TABLE "paradigms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slots" JSONB NOT NULL,
    "notes" TEXT,
    "languageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paradigms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "paradigms_languageId_idx" ON "paradigms"("languageId");

-- CreateIndex
CREATE INDEX "dictionary_entries_paradigmId_idx" ON "dictionary_entries"("paradigmId");

-- AddForeignKey
ALTER TABLE "dictionary_entries" ADD CONSTRAINT "dictionary_entries_paradigmId_fkey" FOREIGN KEY ("paradigmId") REFERENCES "paradigms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paradigms" ADD CONSTRAINT "paradigms_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
