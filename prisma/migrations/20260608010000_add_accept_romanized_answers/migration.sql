-- Per-language opt-in: accept romanized (Latin) answers as correct in lessons.
-- Default off to preserve existing strict matching behavior.
ALTER TABLE "languages"
    ADD COLUMN "acceptRomanizedAnswers" BOOLEAN NOT NULL DEFAULT false;
