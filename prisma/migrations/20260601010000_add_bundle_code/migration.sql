-- Add inline sandboxed widget source for client-sandbox module versions
ALTER TABLE "module_versions" ADD COLUMN "bundleCode" TEXT;
