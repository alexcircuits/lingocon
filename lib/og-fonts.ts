/**
 * Embedded fonts for the Open Graph cards (next/og / Satori needs real font
 * buffers — it can't use system fonts). Uses the brand display font (Gilroy)
 * with Noto Sans as a fallback for diacritics / non-Latin conlang names, plus a
 * Noto italic for the dictionary-style gloss line.
 *
 * Read from the repo working tree (nodejs runtime, full app present on the VPS),
 * memoized for the life of the process.
 */
import { readFileSync } from "fs"
import { join } from "path"

type OgFontWeight = 400 | 500 | 600 | 700 | 800
type OgFontStyle = "normal" | "italic"

export interface OgFont {
  name: string
  data: Buffer
  weight: OgFontWeight
  style: OgFontStyle
}

let cache: OgFont[] | null = null

export function loadOgFonts(): OgFont[] {
  if (cache) return cache

  const app = (f: string) => readFileSync(join(process.cwd(), "app/fonts", f))
  const pub = (f: string) => readFileSync(join(process.cwd(), "public/fonts", f))

  cache = [
    { name: "Gilroy", data: app("Gilroy-Extrabold.ttf"), weight: 800, style: "normal" },
    { name: "Gilroy", data: app("Gilroy-Medium.ttf"), weight: 500, style: "normal" },
    { name: "Gilroy", data: app("Gilroy-Regular.ttf"), weight: 400, style: "normal" },
    { name: "Noto Sans", data: pub("NotoSans-Regular.ttf"), weight: 400, style: "normal" },
    { name: "Noto Sans", data: pub("NotoSans-Italic.ttf"), weight: 400, style: "italic" },
  ]
  return cache
}
