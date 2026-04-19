import fs from "fs/promises"
import path from "path"
import type { DocSlug } from "./site-docs"
import { getDocPage } from "./site-docs"

/**
 * Reads a contributor markdown file from `docs/` (repo root). Only known doc filenames are allowed.
 */
export async function loadDocMarkdown(slug: DocSlug): Promise<string> {
  const { file } = getDocPage(slug)
  const docsDir = path.join(process.cwd(), "docs")
  const resolved = path.resolve(docsDir, file)

  if (!resolved.startsWith(docsDir + path.sep) && resolved !== docsDir) {
    throw new Error("Invalid doc path")
  }

  return fs.readFile(resolved, "utf-8")
}
