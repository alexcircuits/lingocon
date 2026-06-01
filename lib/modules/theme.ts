/**
 * Declarative THEME module support (Tier 0).
 *
 * A THEME module stores a small, validated style descriptor in its version
 * `data`. We never execute author code or inject raw CSS — we only read a
 * fixed set of fields and map them to known CSS custom properties, after
 * validating each value. This keeps themes a zero-risk declarative feature.
 */
import type { CSSProperties } from "react"

export type ResolvedTheme = {
  preset?: string
  /** HSL channel triplet, e.g. "252 88% 64%" (consumed via hsl(var(--x))). */
  primary?: string
  accent?: string
  background?: string
  /** CSS length, e.g. "0.5rem". */
  radius?: string
  /** Validated font-family stack. */
  bodyFont?: string
  headingFont?: string
}

const HSL_TRIPLET = /^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/
const RADIUS = /^(\d{1,2}(\.\d{1,3})?)(px|rem|em)$/
// Letters, numbers, spaces, commas, quotes and hyphens only — no CSS injection.
const FONT_FAMILY = /^[A-Za-z0-9 ,'"\-]{1,120}$/

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** Convert a #rgb / #rrggbb hex string to an "H S% L%" channel triplet. */
function hexToHslTriplet(hex: string): string | null {
  let h = hex.trim().replace(/^#/, "")
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null

  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let s = 0
  let hue = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        hue = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        hue = (b - r) / d + 2
        break
      default:
        hue = (r - g) / d + 4
    }
    hue /= 6
  }
  return `${Math.round(hue * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

/** Accept either a hex color or a pre-formatted HSL triplet. */
function normalizeColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const v = value.trim()
  if (HSL_TRIPLET.test(v)) {
    // Clamp channels defensively.
    const [h, s, l] = v.split(/\s+/)
    const hh = clamp(parseInt(h, 10), 0, 360)
    const ss = clamp(parseInt(s, 10), 0, 100)
    const ll = clamp(parseInt(l, 10), 0, 100)
    return `${hh} ${ss}% ${ll}%`
  }
  if (v.startsWith("#")) return hexToHslTriplet(v) ?? undefined
  return undefined
}

function normalizeFont(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const v = value.trim()
  return FONT_FAMILY.test(v) ? v : undefined
}

/**
 * Read a THEME module version's `data` into a validated theme.
 * Accepts `{ theme: {...} }` or a flat object. Returns null if nothing usable.
 */
export function parseThemeData(data: unknown): ResolvedTheme | null {
  if (!data || typeof data !== "object") return null
  const root = data as Record<string, unknown>
  const src = (root.theme && typeof root.theme === "object"
    ? (root.theme as Record<string, unknown>)
    : root) as Record<string, unknown>

  const theme: ResolvedTheme = {}
  if (typeof src.preset === "string") theme.preset = src.preset.slice(0, 60)
  theme.primary = normalizeColor(src.primary)
  theme.accent = normalizeColor(src.accent)
  theme.background = normalizeColor(src.background)
  if (typeof src.radius === "string" && RADIUS.test(src.radius.trim())) {
    theme.radius = src.radius.trim()
  }
  theme.bodyFont = normalizeFont(src.bodyFont)
  theme.headingFont = normalizeFont(src.headingFont)

  const hasAny =
    theme.primary || theme.accent || theme.background || theme.radius || theme.bodyFont || theme.headingFont
  return hasAny ? theme : null
}

/** Map a resolved theme to a scoped inline style (CSS variables + base font). */
export function themeToStyle(theme: ResolvedTheme): CSSProperties {
  const style: Record<string, string> = {}
  if (theme.primary) {
    style["--primary"] = theme.primary
    style["--ring"] = theme.primary
  }
  if (theme.accent) style["--accent"] = theme.accent
  if (theme.background) {
    style["--background"] = theme.background
    style.backgroundColor = `hsl(${theme.background})`
  }
  if (theme.radius) style["--radius"] = theme.radius
  if (theme.bodyFont) style.fontFamily = theme.bodyFont
  return style as CSSProperties
}
