-- CreateEnum
CREATE TYPE "TextType" AS ENUM ('BOOK', 'SHORT_STORY', 'POEM', 'SONG', 'DIALOGUE', 'ESSAY', 'TRANSLATION', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEntityType" ADD VALUE 'ARTICLE';
ALTER TYPE "ActivityEntityType" ADD VALUE 'TEXT';

-- AlterTable
ALTER TABLE "languages" ADD COLUMN     "discordUrl" TEXT,
ADD COLUMN     "flagUrl" TEXT,
ADD COLUMN     "telegramUrl" TEXT,
ADD COLUMN     "websiteUrl" TEXT;

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" JSONB NOT NULL,
    "coverImage" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "languageId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "texts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" "TextType" NOT NULL DEFAULT 'OTHER',
    "content" JSONB,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "coverImage" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "languageId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "texts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "articles_languageId_idx" ON "articles"("languageId");

-- CreateIndex
CREATE INDEX "articles_authorId_idx" ON "articles"("authorId");

-- CreateIndex
CREATE INDEX "articles_languageId_published_idx" ON "articles"("languageId", "published");

-- CreateIndex
CREATE INDEX "articles_publishedAt_idx" ON "articles"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "articles_languageId_slug_key" ON "articles"("languageId", "slug");

-- CreateIndex
CREATE INDEX "texts_languageId_idx" ON "texts"("languageId");

-- CreateIndex
CREATE INDEX "texts_authorId_idx" ON "texts"("authorId");

-- CreateIndex
CREATE INDEX "texts_languageId_type_idx" ON "texts"("languageId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "texts_languageId_slug_key" ON "texts"("languageId", "slug");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "texts" ADD CONSTRAINT "texts_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "texts" ADD CONSTRAINT "texts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
