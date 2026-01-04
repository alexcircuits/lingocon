-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "paradigmId" TEXT;

-- AlterTable
ALTER TABLE "grammar_pages" ADD COLUMN     "paradigmId" TEXT;

-- AlterTable
ALTER TABLE "texts" ADD COLUMN     "paradigmId" TEXT;

-- CreateIndex
CREATE INDEX "articles_paradigmId_idx" ON "articles"("paradigmId");

-- CreateIndex
CREATE INDEX "grammar_pages_paradigmId_idx" ON "grammar_pages"("paradigmId");

-- CreateIndex
CREATE INDEX "texts_paradigmId_idx" ON "texts"("paradigmId");

-- AddForeignKey
ALTER TABLE "grammar_pages" ADD CONSTRAINT "grammar_pages_paradigmId_fkey" FOREIGN KEY ("paradigmId") REFERENCES "paradigms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_paradigmId_fkey" FOREIGN KEY ("paradigmId") REFERENCES "paradigms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "texts" ADD CONSTRAINT "texts_paradigmId_fkey" FOREIGN KEY ("paradigmId") REFERENCES "paradigms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
