-- Index the visibility column: every public search filters
-- `visibility = 'PUBLIC'`, and the join from dictionary entries / grammar /
-- articles / texts back to languages had no way to apply that predicate
-- cheaply. Plain CREATE INDEX (not CONCURRENTLY) to match this project's
-- migration convention and because `languages` is a small table; the brief
-- write lock is negligible. Name matches Prisma's @@index([visibility]).
CREATE INDEX "languages_visibility_idx" ON "languages"("visibility");
