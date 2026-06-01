-- CreateEnum
CREATE TYPE "ModuleType" AS ENUM ('STUDIO_PANEL', 'READER_WIDGET', 'CONTENT_BLOCK', 'TRANSFORMER', 'GENERATOR', 'EXPORTER', 'IMPORTER', 'VISUALIZER', 'VALIDATOR', 'THEME');

-- CreateEnum
CREATE TYPE "ModuleTier" AS ENUM ('DECLARATIVE', 'CLIENT_SANDBOX', 'SERVER');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'SUSPENDED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "ModuleReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "type" "ModuleType" NOT NULL,
    "tier" "ModuleTier" NOT NULL DEFAULT 'DECLARATIVE',
    "status" "ModuleStatus" NOT NULL DEFAULT 'DRAFT',
    "icon" TEXT,
    "repoUrl" TEXT,
    "homepageUrl" TEXT,
    "license" TEXT,
    "tags" JSONB,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "isVerifiedAuthor" BOOLEAN NOT NULL DEFAULT false,
    "addCount" INTEGER NOT NULL DEFAULT 0,
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_versions" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "permissions" JSONB,
    "sdkRange" TEXT,
    "changelog" TEXT,
    "data" JSONB,
    "bundleUrl" TEXT,
    "bundleHash" TEXT,
    "yanked" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_installs" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "languageId" TEXT,
    "settings" JSONB,
    "grantedPermissions" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_installs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_reviews" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_reports" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ModuleReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modules_slug_key" ON "modules"("slug");

-- CreateIndex
CREATE INDEX "modules_authorId_idx" ON "modules"("authorId");

-- CreateIndex
CREATE INDEX "modules_slug_idx" ON "modules"("slug");

-- CreateIndex
CREATE INDEX "modules_status_idx" ON "modules"("status");

-- CreateIndex
CREATE INDEX "modules_type_idx" ON "modules"("type");

-- CreateIndex
CREATE INDEX "modules_status_type_idx" ON "modules"("status", "type");

-- CreateIndex
CREATE INDEX "module_versions_moduleId_idx" ON "module_versions"("moduleId");

-- CreateIndex
CREATE INDEX "module_versions_moduleId_publishedAt_idx" ON "module_versions"("moduleId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "module_versions_moduleId_version_key" ON "module_versions"("moduleId", "version");

-- CreateIndex
CREATE INDEX "module_installs_moduleId_idx" ON "module_installs"("moduleId");

-- CreateIndex
CREATE INDEX "module_installs_userId_idx" ON "module_installs"("userId");

-- CreateIndex
CREATE INDEX "module_installs_languageId_idx" ON "module_installs"("languageId");

-- CreateIndex
CREATE INDEX "module_installs_languageId_enabled_idx" ON "module_installs"("languageId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "module_installs_moduleId_userId_languageId_key" ON "module_installs"("moduleId", "userId", "languageId");

-- CreateIndex
CREATE INDEX "module_reviews_moduleId_idx" ON "module_reviews"("moduleId");

-- CreateIndex
CREATE INDEX "module_reviews_userId_idx" ON "module_reviews"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "module_reviews_moduleId_userId_key" ON "module_reviews"("moduleId", "userId");

-- CreateIndex
CREATE INDEX "module_reports_moduleId_idx" ON "module_reports"("moduleId");

-- CreateIndex
CREATE INDEX "module_reports_reporterId_idx" ON "module_reports"("reporterId");

-- CreateIndex
CREATE INDEX "module_reports_status_idx" ON "module_reports"("status");

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_installs" ADD CONSTRAINT "module_installs_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_installs" ADD CONSTRAINT "module_installs_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "module_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_installs" ADD CONSTRAINT "module_installs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_installs" ADD CONSTRAINT "module_installs_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_reviews" ADD CONSTRAINT "module_reviews_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_reviews" ADD CONSTRAINT "module_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_reports" ADD CONSTRAINT "module_reports_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_reports" ADD CONSTRAINT "module_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
