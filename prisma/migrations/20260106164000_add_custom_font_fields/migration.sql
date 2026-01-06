-- AlterTable
ALTER TABLE "Language" ADD COLUMN     "fontFamily" TEXT,
ADD COLUMN     "fontScale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "fontUrl" TEXT;
