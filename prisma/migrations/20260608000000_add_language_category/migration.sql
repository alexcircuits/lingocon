-- Language category: classify each language by origin/use
-- (constructed, natural, endangered, restored, historical, fictional, auxiliary, other).
CREATE TYPE "LanguageCategory" AS ENUM (
    'CONLANG',
    'NATURAL',
    'ENDANGERED',
    'RESTORED',
    'HISTORICAL',
    'FICTIONAL',
    'AUXILIARY',
    'OTHER'
);

ALTER TABLE "languages"
    ADD COLUMN "category" "LanguageCategory" NOT NULL DEFAULT 'CONLANG';

CREATE INDEX "languages_category_idx" ON "languages"("category");
