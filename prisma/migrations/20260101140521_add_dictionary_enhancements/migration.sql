-- AlterTable
ALTER TABLE "dictionary_entries" ADD COLUMN     "etymology" TEXT,
ADD COLUMN     "relatedWords" JSONB;
