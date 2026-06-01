-- CreateTable
CREATE TABLE "slug_reservations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "reservedUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slug_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slug_reservations_slug_key" ON "slug_reservations"("slug");

-- CreateIndex
CREATE INDEX "slug_reservations_slug_idx" ON "slug_reservations"("slug");

-- CreateIndex
CREATE INDEX "slug_reservations_reservedUntil_idx" ON "slug_reservations"("reservedUntil");

-- AddForeignKey
ALTER TABLE "slug_reservations" ADD CONSTRAINT "slug_reservations_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
