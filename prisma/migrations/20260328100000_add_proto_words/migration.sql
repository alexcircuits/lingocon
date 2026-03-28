-- CreateTable
CREATE TABLE "proto_words" (
    "id" TEXT NOT NULL,
    "lemma" TEXT NOT NULL,
    "gloss" TEXT NOT NULL,
    "ipa" TEXT,
    "notes" TEXT,
    "familyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proto_words_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "dictionary_entries" ADD COLUMN "protoSourceId" TEXT;

-- CreateIndex
CREATE INDEX "proto_words_familyId_idx" ON "proto_words"("familyId");

-- CreateIndex
CREATE INDEX "proto_words_familyId_lemma_idx" ON "proto_words"("familyId", "lemma");

-- CreateIndex
CREATE INDEX "dictionary_entries_protoSourceId_idx" ON "dictionary_entries"("protoSourceId");

-- AddForeignKey
ALTER TABLE "proto_words" ADD CONSTRAINT "proto_words_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "language_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dictionary_entries" ADD CONSTRAINT "dictionary_entries_protoSourceId_fkey" FOREIGN KEY ("protoSourceId") REFERENCES "proto_words"("id") ON DELETE SET NULL ON UPDATE CASCADE;
