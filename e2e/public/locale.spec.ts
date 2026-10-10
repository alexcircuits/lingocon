import { test, expect, expectNoPageErrors } from "../fixtures"
import { EN, readMessages } from "./helpers"

/**
 * Interface language comes from the NEXT_LOCALE cookie (lib/i18n/request.ts). `<html lang>`
 * is the BCP-47 tag (the legacy `free-ru` code maps to `ru`), and every translated string —
 * including ones with ICU arguments such as the footer copyright — must render, never its key.
 */
const LOCALES = [
  { cookie: "free-ru", lang: "ru" },
  { cookie: "uk", lang: "uk" },
  { cookie: "fr", lang: "fr" },
  { cookie: "br", lang: "br" },
] as const

const YEAR = new Date().getFullYear()

test.describe("interface language", () => {
  for (const { cookie, lang } of LOCALES) {
    test(`NEXT_LOCALE=${cookie} renders the ${lang} interface`, async ({ page, context, baseURL, pageErrors }) => {
      const messages = readMessages(cookie)
      await context.addCookies([{ name: "NEXT_LOCALE", value: cookie, url: baseURL! }])
      await page.goto("/")
      await expect(page.locator("html")).toHaveAttribute("lang", lang)

      const footer = page.locator("footer")
      await expect(footer).toContainText(messages.footer.copyright.replace("{year}", String(YEAR)))
      await expect(footer.getByRole("heading", { name: messages.footer.product })).toBeVisible()
      await expect(footer.getByRole("heading", { name: messages.footer.community })).toBeVisible()
      await expect(footer).not.toContainText("footer.")
      // The navbar is translated too.
      await expect(page.locator("header").getByRole("link", { name: messages.common.signIn })).toBeVisible()
      expectNoPageErrors(pageErrors)
    })
  }

  test("an unknown NEXT_LOCALE value falls back to English", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "NEXT_LOCALE", value: "xx-not-a-locale", url: baseURL! }])
    await page.goto("/")
    await expect(page.locator("html")).toHaveAttribute("lang", "en")
    await expect(page.locator("footer")).toContainText(EN.footer.copyright.replace("{year}", String(YEAR)))
  })

  test("the language switcher sets the cookie and re-renders the page", async ({ page, context, pageErrors }) => {
    const fr = readMessages("fr")
    await page.goto("/browse")
    await expect(page.locator("html")).toHaveAttribute("lang", "en")
    await page.getByRole("button", { name: EN.i18n.switcherLabel }).click()
    await page.getByRole("menuitem", { name: new RegExp(EN.i18n.french) }).click()

    await expect(page.locator("html")).toHaveAttribute("lang", "fr")
    await expect(page.locator("footer").getByRole("heading", { name: fr.footer.product })).toBeVisible()
    const cookie = (await context.cookies()).find((c) => c.name === "NEXT_LOCALE")
    expect(cookie?.value).toBe("fr")

    // It sticks across navigations.
    await page.goto("/login")
    await expect(page.getByRole("heading", { level: 1, name: fr.auth.signInTitle })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })
})
