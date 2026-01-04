-- CreateEnum
CREATE TYPE "CollaboratorRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "language_collaborators" (
    "id" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CollaboratorRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "language_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "language_collaborators_languageId_idx" ON "language_collaborators"("languageId");

-- CreateIndex
CREATE INDEX "language_collaborators_userId_idx" ON "language_collaborators"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "language_collaborators_languageId_userId_key" ON "language_collaborators"("languageId", "userId");

-- AddForeignKey
ALTER TABLE "language_collaborators" ADD CONSTRAINT "language_collaborators_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_collaborators" ADD CONSTRAINT "language_collaborators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
