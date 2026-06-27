-- AlterTable
ALTER TABLE "languages" ADD COLUMN     "featuredAt" TIMESTAMP(3),
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;
