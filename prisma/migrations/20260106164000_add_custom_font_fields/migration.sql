-- AlterTable
ALTER TABLE "languages" ADD COLUMN     "fontFamily" TEXT,
ADD COLUMN     "fontScale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "fontUrl" TEXT;
