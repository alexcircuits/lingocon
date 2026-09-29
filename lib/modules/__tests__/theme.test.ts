import { describe, it, expect } from "vitest"
import { parseThemeData, themeToStyle } from "../theme"

/** Parse a single color field and return the normalized HSL triplet. */
function parsePrimary(value: unknown): string | undefined {
  return parseThemeData({ primary: value })?.primary
}

describe("parseThemeData", () => {
  describe("colors", () => {
    it.each([
      ["#7c3aed", "262 83% 58%"],
      ["#ff0000", "0 100% 50%"],
      ["#00ff00", "120 100% 50%"],
      ["#0000ff", "240 100% 50%"],
      ["#000000", "0 0% 0%"],
      ["#ffffff", "0 0% 100%"],
      ["#808080", "0 0% 50%"],
      // Channels round to nearest (238.7 -> 239, 83.5 -> 84, 66.7 -> 67), not truncate.
      ["#6366f1", "239 84% 67%"],
      // Red-dominant with blue > green: hue wraps into 330-360 instead of going negative.
      ["#f43f5e", "350 89% 60%"],
      ["#ff0080", "330 100% 50%"],
    ])("converts hex %s to the HSL triplet %s", (hex, expected) => {
      expect(parsePrimary(hex)).toBe(expected)
    })

    it("expands #rgb shorthand to the same color as #rrggbb", () => {
      expect(parsePrimary("#f0a")).toBe(parsePrimary("#ff00aa"))
      expect(parsePrimary("#f0a")).toBeDefined()
    })

    it("accepts uppercase hex and surrounding whitespace", () => {
      expect(parsePrimary("  #FF0000  ")).toBe("0 100% 50%")
    })

    it("passes an in-range HSL triplet through unchanged", () => {
      expect(parsePrimary("252 88% 64%")).toBe("252 88% 64%")
    })

    it("normalizes separators in an HSL triplet to single spaces", () => {
      expect(parsePrimary("252\n88%   64%")).toBe("252 88% 64%")
    })

    it("clamps out-of-range HSL channels", () => {
      expect(parsePrimary("999 500% 200%")).toBe("360 100% 100%")
    })

    it("strips leading zeros from HSL channels", () => {
      expect(parsePrimary("007 05% 05%")).toBe("7 5% 5%")
    })

    it("reads primary, accent and background independently", () => {
      const theme = parseThemeData({
        primary: "#ff0000",
        accent: "120 100% 50%",
        background: "#000",
      })
      expect(theme).toEqual({
        primary: "0 100% 50%",
        accent: "120 100% 50%",
        background: "0 0% 0%",
      })
    })

    it.each([
      ["hex without #", "ff0000"],
      ["non-hex digits", "#ggg"],
      ["5 hex digits", "#12345"],
      ["4 hex digits (alpha)", "#1234"],
      ["8 hex digits (alpha)", "#12345678"],
      ["double hash", "##fff"],
      ["named color", "red"],
      ["rgb() function", "rgb(255, 0, 0)"],
      ["hsl() function", "hsl(0 100% 50%)"],
      ["HSL without percent signs", "1 2 3"],
      ["HSL with missing final percent", "1 2% 3"],
      ["HSL hue over 3 digits", "1234 2% 3%"],
      ["empty string", ""],
    ])("ignores an unusable color (%s)", (_label, value) => {
      expect(parseThemeData({ primary: value, radius: "4px" })).toEqual({ radius: "4px" })
    })

    it.each([
      ["hex + declaration break", "#fff; } body { display:none }"],
      ["hex + url()", "#fff url(http://evil.example/x)"],
      ["HSL + declaration", "1 2% 3%; color: red"],
      ["HSL + style close", "1 2% 3%</style>"],
    ])("does not let CSS through a color field (%s)", (_label, value) => {
      expect(parseThemeData({ primary: value, accent: value, background: value })).toBeNull()
    })

    it.each([[5], [null], [undefined], [{}], [["#fff"]], [true]])(
      "ignores a non-string color (%j)",
      (value) => {
        expect(parsePrimary(value)).toBeUndefined()
      }
    )
  })

  describe("radius", () => {
    it.each(["0.5rem", "8px", "1.25em", "12.5px", "0px"])("accepts %s", (radius) => {
      expect(parseThemeData({ radius })).toEqual({ radius })
    })

    it("trims surrounding whitespace", () => {
      expect(parseThemeData({ radius: " 4px " })).toEqual({ radius: "4px" })
    })

    it.each([
      ["declaration break", "1rem; } body { display:none }"],
      ["negative", "-1rem"],
      ["three integer digits", "100px"],
      ["no unit", "0.5"],
      ["unsupported unit", "1vh"],
      ["css function", "calc(1px)"],
      ["four decimal places", "1.5555rem"],
      ["no leading digit", ".5rem"],
      ["uppercase unit", "1REM"],
    ])("rejects %s", (_label, radius) => {
      expect(parseThemeData({ radius })).toBeNull()
    })

    it("ignores a non-string radius", () => {
      expect(parseThemeData({ radius: 8 })).toBeNull()
    })
  })

  describe("font-family", () => {
    it.each([
      "Inter",
      "Helvetica Neue",
      '"Helvetica Neue", Arial, sans-serif',
      "'Fira Code', monospace",
      "Source-Serif-4, serif",
    ])("accepts %s", (bodyFont) => {
      expect(parseThemeData({ bodyFont })).toEqual({ bodyFont })
    })

    it("applies the same validation to headingFont", () => {
      expect(parseThemeData({ headingFont: "Georgia, serif" })).toEqual({
        headingFont: "Georgia, serif",
      })
      expect(parseThemeData({ headingFont: "x; } body { display:none" })).toBeNull()
    })

    it.each([
      ["declaration break with rule injection", "x; } body { display:none"],
      ["url()", "url(http://evil.example/font.woff)"],
      ["style tag close", "</style>"],
      ["style tag close after a valid family", "Arial</style><script>alert(1)</script>"],
      ["at-rule", "@import 'https://evil.example/x.css'"],
      ["expression()", "expression(alert(1))"],
      ["!important", "Arial !important"],
      ["comment", "Arial /* x */"],
      ["escaped char", "Arial\\3b"],
      ["newline", "Arial\nbody"],
    ])("rejects %s", (_label, bodyFont) => {
      expect(parseThemeData({ bodyFont })).toBeNull()
      expect(parseThemeData({ headingFont: bodyFont })).toBeNull()
    })

    it.each([";", "{", "}", "<", ">", "(", ")", "\\", "/", ":", "@", "!", "*", "=", "\n", "\r", "\t", "&", "#", "%"])(
      "rejects a family name containing %j",
      (char) => {
        expect(parseThemeData({ bodyFont: `Arial${char}Bold` })).toBeNull()
      }
    )

    it("accepts a 120 character stack and rejects a 121 character one", () => {
      expect(parseThemeData({ bodyFont: "a".repeat(120) })?.bodyFont).toHaveLength(120)
      expect(parseThemeData({ bodyFont: "a".repeat(121) })).toBeNull()
    })

    it("drops an empty or whitespace-only family instead of keeping an empty string", () => {
      // Paired with a valid field so an accepted "" would show up in the result.
      expect(parseThemeData({ bodyFont: "", primary: "#fff" })).toEqual({ primary: "0 0% 100%" })
      expect(parseThemeData({ headingFont: "   ", primary: "#fff" })).toEqual({ primary: "0 0% 100%" })
    })

    it("ignores non-string fonts", () => {
      expect(parseThemeData({ bodyFont: 12, headingFont: ["Arial"] })).toBeNull()
    })
  })

  describe("payload shape", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["a string", "primary: #fff"],
      ["a number", 5],
      ["a boolean", true],
      ["an empty array", []],
      ["an array holding a theme", [{ primary: "#fff" }]],
      ["an empty object", {}],
      ["an empty theme wrapper", { theme: {} }],
      ["unknown keys only", { color: "#fff", css: "body { display:none }" }],
      ["only invalid values", { primary: "red", radius: "big", bodyFont: "url(x)" }],
    ])("returns null for %s", (_label, data) => {
      expect(parseThemeData(data)).toBeNull()
    })

    it("reads a theme nested under `theme`", () => {
      expect(parseThemeData({ theme: { primary: "#fff", radius: "4px" } })).toEqual({
        primary: "0 0% 100%",
        radius: "4px",
      })
    })

    it("reads a flat theme object", () => {
      expect(parseThemeData({ primary: "#fff", radius: "4px" })).toEqual({
        primary: "0 0% 100%",
        radius: "4px",
      })
    })

    it.each([["a string", "dark"], ["null", null], ["a number", 3]])(
      "falls back to the flat object when `theme` is %s",
      (_label, theme) => {
        expect(parseThemeData({ theme, primary: "#fff" })).toEqual({ primary: "0 0% 100%" })
      }
    )

    it("keeps a preset alongside a usable field, truncated to 60 characters", () => {
      const theme = parseThemeData({ preset: "x".repeat(80), primary: "#fff" })
      expect(theme?.preset).toBe("x".repeat(60))
    })

    it("keeps valid fields and drops the invalid ones", () => {
      const theme = parseThemeData({
        primary: "#ff0000",
        accent: "expression(alert(1))",
        radius: "1rem; } body { display:none }",
        bodyFont: "Inter, sans-serif",
        headingFont: "</style>",
      })
      expect(theme).toEqual({ primary: "0 100% 50%", bodyFont: "Inter, sans-serif" })
    })
  })
})

describe("themeToStyle", () => {
  it("maps a full resolved theme to the expected CSS custom properties", () => {
    expect(
      themeToStyle({
        primary: "262 83% 58%",
        accent: "10 20% 30%",
        background: "0 0% 100%",
        radius: "0.5rem",
        bodyFont: "Inter, sans-serif",
      })
    ).toEqual({
      "--primary": "262 83% 58%",
      "--ring": "262 83% 58%",
      "--accent": "10 20% 30%",
      "--background": "0 0% 100%",
      backgroundColor: "hsl(0 0% 100%)",
      "--radius": "0.5rem",
      fontFamily: "Inter, sans-serif",
    })
  })

  it("sets both --primary and --ring from primary", () => {
    expect(themeToStyle({ primary: "1 2% 3%" })).toEqual({ "--primary": "1 2% 3%", "--ring": "1 2% 3%" })
  })

  it("sets --background and a matching hsl() backgroundColor from background", () => {
    expect(themeToStyle({ background: "220 14% 96%" })).toEqual({
      "--background": "220 14% 96%",
      backgroundColor: "hsl(220 14% 96%)",
    })
  })

  it("emits nothing for fields the theme does not set", () => {
    expect(themeToStyle({ radius: "8px" })).toEqual({ "--radius": "8px" })
    expect(themeToStyle({ accent: "1 2% 3%" })).toEqual({ "--accent": "1 2% 3%" })
    expect(themeToStyle({ bodyFont: "Inter" })).toEqual({ fontFamily: "Inter" })
  })

  it("returns an empty style for an empty theme", () => {
    expect(themeToStyle({})).toEqual({})
  })

  it("uses bodyFont, not headingFont, for the base font", () => {
    const style = themeToStyle({ bodyFont: "Inter", headingFont: "Georgia" })
    expect(style.fontFamily).toBe("Inter")
    expect(themeToStyle({ headingFont: "Georgia" }).fontFamily).toBeUndefined()
  })

  it("exposes headingFont as a variable so the public page applies it to headings", () => {
    const style = themeToStyle({ headingFont: "Georgia, serif" }) as Record<string, string>
    expect(style["--theme-heading-font"]).toBe("Georgia, serif")
    expect(themeToStyle({ bodyFont: "Inter" })).not.toHaveProperty("--theme-heading-font")
  })

  it("does not mutate the theme it is given", () => {
    const theme = Object.freeze({ primary: "1 2% 3%", background: "4 5% 6%" })
    expect(() => themeToStyle(theme)).not.toThrow()
    expect(theme).toEqual({ primary: "1 2% 3%", background: "4 5% 6%" })
  })

  it("never emits CSS-breaking characters for a theme that came through parseThemeData", () => {
    const theme = parseThemeData({
      primary: "#7c3aed; } body { display:none }",
      accent: "url(http://evil.example)",
      background: "#0f172a",
      radius: "0.5rem",
      bodyFont: "Inter, sans-serif",
      headingFont: "x; } body { display:none",
    })
    expect(theme).not.toBeNull()

    const style = themeToStyle(theme!)
    const values = Object.values(style).map(String)
    expect(values.length).toBeGreaterThan(0)
    for (const value of values) {
      expect(value).not.toMatch(/[;{}<>\\]|url\(|expression\(/i)
    }
    // The rejected fields must not appear at all, not even as empty values.
    expect(style).not.toHaveProperty("--primary")
    expect(style).not.toHaveProperty("--accent")
  })
})
