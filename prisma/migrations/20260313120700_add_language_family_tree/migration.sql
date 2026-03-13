-- AlterTable
ALTER TABLE "languages" ADD COLUMN "parentLanguageId" TEXT;

-- CreateIndex
CREATE INDEX "languages_parentLanguageId_idx" ON "languages"("parentLanguageId");

-- AddForeignKey
ALTER TABLE "languages" ADD CONSTRAINT "languages_parentLanguageId_fkey" FOREIGN KEY ("parentLanguageId") REFERENCES "languages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
