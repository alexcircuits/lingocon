-- Mark all existing users as email-verified so they are not locked out
UPDATE "users"
SET "emailVerified" = "createdAt"
WHERE "emailVerified" IS NULL AND "password" IS NOT NULL;
