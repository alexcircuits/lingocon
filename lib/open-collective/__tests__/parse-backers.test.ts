import { describe, expect, it } from "vitest"
import { OpenCollectiveResponseError, parseTopBackers } from "../parse-backers"
import { member, payload } from "./fixtures"

const names = (result: ReturnType<typeof parseTopBackers>) => result.backers.map((b) => b.name)

describe("parseTopBackers", () => {
  it("maps a backer to name, avatar, profile link and total", () => {
    const result = parseTopBackers(payload([member(6400)]), 12)

    expect(result).toEqual({
      currency: "EUR",
      skipped: 0,
      backers: [
        {
          name: "Ada Lovelace",
          kind: "individual",
          profileUrl: "https://opencollective.com/ada",
          imageUrl: "https://images.opencollective.com/ada/7a79991/avatar/128.png",
          totalCents: 6400,
        },
      ],
    })
  })

  it("orders by total contributed, largest first, whatever order the API used", () => {
    const result = parseTopBackers(
      payload([
        member(1000, { id: "a", slug: "small", name: "Small" }),
        member(9000, { id: "b", slug: "large", name: "Large" }),
        member(2400, { id: "c", slug: "medium", name: "Medium" }),
      ]),
      12,
    )

    expect(names(result)).toEqual(["Large", "Medium", "Small"])
  })

  it("keeps the API order between backers who gave the same amount", () => {
    const result = parseTopBackers(
      payload([
        member(500, { id: "a", slug: "first", name: "First" }),
        member(500, { id: "b", slug: "second", name: "Second" }),
      ]),
      12,
    )

    expect(names(result)).toEqual(["First", "Second"])
  })

  it("lists an account once even when it holds several memberships (one per tier)", () => {
    const result = parseTopBackers(
      payload([
        member(38_998_500, { id: "org", slug: "trivago", name: "trivago", type: "ORGANIZATION" }),
        member(38_998_500, { id: "org", slug: "trivago", name: "trivago", type: "ORGANIZATION" }),
        member(100, { id: "ada" }),
      ]),
      12,
    )

    expect(names(result)).toEqual(["trivago", "Ada Lovelace"])
    expect(result.backers[0].kind).toBe("organization")
  })

  it("returns at most `limit` backers", () => {
    const nodes = Array.from({ length: 30 }, (_, i) => member(1000 + i, { id: `a${i}`, slug: `s${i}`, name: `N${i}` }))

    const result = parseTopBackers(payload(nodes), 12)

    expect(result.backers).toHaveLength(12)
    expect(result.backers[0].name).toBe("N29")
  })

  it("returns an empty list for a collective with no backers yet", () => {
    expect(parseTopBackers(payload([]), 12)).toEqual({ currency: "EUR", backers: [], skipped: 0 })
  })

  it("does not mutate the payload it was given", () => {
    const input = payload([member(100, { id: "a" }), member(900, { id: "b", slug: "b" })])
    const snapshot = structuredClone(input)

    parseTopBackers(input, 12)

    expect(input).toEqual(snapshot)
  })

  describe("privacy", () => {
    it("keeps an incognito contributor anonymous: no name, no avatar, no profile link", () => {
      const result = parseTopBackers(
        payload([member(5000, { id: "x", slug: "incognito-1a2b3c", name: "Jane Secret", isIncognito: true })]),
        12,
      )

      expect(result.backers).toEqual([
        { name: null, kind: "individual", profileUrl: null, imageUrl: null, totalCents: 5000 },
      ])
      expect(JSON.stringify(result)).not.toMatch(/Jane|incognito-1a2b3c/)
    })

    it("treats a contributor as anonymous when the incognito flag is missing", () => {
      const result = parseTopBackers(payload([member(5000, { isIncognito: undefined })]), 12)

      expect(result.backers[0]).toMatchObject({ name: null, profileUrl: null, imageUrl: null })
    })

    it("treats an incognito-looking slug as anonymous even if the flag says otherwise", () => {
      const result = parseTopBackers(payload([member(5000, { slug: "incognito-9f8e7d", isIncognito: false })]), 12)

      expect(result.backers[0]).toMatchObject({ name: null, profileUrl: null, imageUrl: null })
    })

    it("shows a nameless contributor as anonymous rather than by their slug", () => {
      const result = parseTopBackers(payload([member(5000, { name: "   " })]), 12)

      expect(result.backers[0]).toMatchObject({ name: null, profileUrl: null })
    })

    it("never carries fields it was not asked for (emails, legal names) into the result", () => {
      const result = parseTopBackers(
        payload([member(5000, { email: "ada@example.com", emails: ["ada@example.com"], legalName: "Augusta King" })]),
        12,
      )

      expect(JSON.stringify(result)).not.toMatch(/example\.com|Augusta/)
    })
  })

  describe("untrusted input", () => {
    it.each([
      ["not an object", "nope"],
      ["null", null],
      ["missing data", {}],
      ["account not found", { data: { account: null } }],
      ["members missing", { data: { account: { slug: "lingocon", currency: "EUR" } } }],
      ["nodes not a list", payload([], { members: { nodes: "x" } })],
      ["bad collective currency", payload([], { currency: "euros" })],
    ])("throws OpenCollectiveResponseError when the envelope is malformed: %s", (_label, input) => {
      expect(() => parseTopBackers(input, 12)).toThrow(OpenCollectiveResponseError)
    })

    it("skips malformed members and counts them instead of failing the whole list", () => {
      const result = parseTopBackers(
        payload([
          member(700),
          null,
          "garbage",
          member(900, { id: "no-account" }, { account: null }),
          member(900, { id: "bad-role", slug: "admin" }, { role: "ADMIN" }),
          member(900, { id: "bad-amount", slug: "nan" }, { totalDonations: { valueInCents: "lots", currency: "EUR" } }),
          member(0, { id: "zero", slug: "zero" }),
          member(-500, { id: "negative", slug: "negative" }),
          member(900, { id: "bad-slug", slug: "../../evil" }),
          member(900, { id: "usd", slug: "usd" }, { totalDonations: { valueInCents: 900, currency: "USD" } }),
        ]),
        12,
      )

      expect(names(result)).toEqual(["Ada Lovelace"])
      expect(result.skipped).toBe(9)
    })

    it.each([
      ["http, not https", "http://images.opencollective.com/ada/avatar.png"],
      ["another host", "https://evil.example/avatar.png"],
      ["a look-alike host", "https://images.opencollective.com.evil.example/a.png"],
      ["carrying credentials", "https://user:pass@images.opencollective.com/a.png"],
      ["on a non-default port", "https://images.opencollective.com:8443/a.png"],
      ["a javascript: URL", "javascript:alert(1)"],
      ["not a URL", "avatar.png"],
      ["null", null],
    ])("drops an avatar URL that is %s", (_label, imageUrl) => {
      const result = parseTopBackers(payload([member(100, { imageUrl })]), 12)

      expect(result.backers[0]).toMatchObject({ name: "Ada Lovelace", imageUrl: null })
    })

    it("strips control and bidi-override characters from names and collapses whitespace", () => {
      const result = parseTopBackers(
        payload([member(100, { name: "  Ada\u202E\n\t\u2028  Love\u061C\u180Elace\u0000\u200B " })]),
        12,
      )

      expect(result.backers[0].name).toBe("Ada Lovelace")
    })

    it("truncates absurdly long names", () => {
      const result = parseTopBackers(payload([member(100, { name: "x".repeat(500) })]), 12)

      expect(result.backers[0].name).toHaveLength(80)
    })

    it("builds the profile link from the slug, never from a URL in the payload", () => {
      const result = parseTopBackers(
        payload([member(100, { slug: "date-fns_2", website: "https://evil.example", url: "https://evil.example" })]),
        12,
      )

      expect(result.backers[0].profileUrl).toBe("https://opencollective.com/date-fns_2")
    })

    it("rounds fractional cents", () => {
      const result = parseTopBackers(payload([member(1234.6)]), 12)

      expect(result.backers[0].totalCents).toBe(1235)
    })
  })
})
