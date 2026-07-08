-- Auto-inflection: per-cell transform rules + materialized inflected forms.
-- pg_trgm is already enabled (see the FTS foundation migration).

-- CreateTable
CREATE TABLE "paradigm_rules" (
    "id" TEXT NOT NULL,
    "paradigmId" TEXT NOT NULL,
    "cellKey" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "suffix" TEXT NOT NULL DEFAULT '',
    "soundChange" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paradigm_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inflected_forms" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "cellKey" TEXT NOT NULL,
    "form" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inflected_forms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paradigm_rules_paradigmId_cellKey_key" ON "paradigm_rules"("paradigmId", "cellKey");
CREATE INDEX "paradigm_rules_paradigmId_idx" ON "paradigm_rules"("paradigmId");

CREATE UNIQUE INDEX "inflected_forms_entryId_cellKey_key" ON "inflected_forms"("entryId", "cellKey");
CREATE INDEX "inflected_forms_entryId_idx" ON "inflected_forms"("entryId");
CREATE INDEX "inflected_forms_form_idx" ON "inflected_forms"("form");
CREATE INDEX "inflected_forms_form_trgm_idx" ON "inflected_forms" USING GIN ("form" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "paradigm_rules" ADD CONSTRAINT "paradigm_rules_paradigmId_fkey" FOREIGN KEY ("paradigmId") REFERENCES "paradigms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inflected_forms" ADD CONSTRAINT "inflected_forms_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "dictionary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
