import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { expect, type Page } from "../fixtures"

/** English UI strings, so assertions follow the copy instead of hard-coding it twice. */
export type Messages = Record<string, Record<string, string>>

export function readMessages(locale: string): Messages {
  const file = resolve(__dirname, "../../messages", `${locale}.json`)
  return JSON.parse(readFileSync(file, "utf8")) as Messages
}

export const EN = readMessages("en")

/**
 * The app's not-found UI (app/not-found.tsx). Pages below a `loading.tsx` boundary
 * (/lang/*, /studio/*) stream before `notFound()` runs, so their HTTP status is 200;
 * Next marks those responses `noindex` instead, which this also checks.
 */
export async function expectNotFoundPage(page: Page): Promise<void> {
  await expect(page.getByText(EN.errors.pageNotFound, { exact: true })).toBeVisible()
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached()
}

/** Content of `<meta property|name=…>` in the current document. */
export async function metaContent(page: Page, key: string): Promise<string | null> {
  const meta = page.locator(`meta[property="${key}"], meta[name="${key}"]`).first()
  return meta.getAttribute("content")
}
