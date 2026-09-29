import { describe, it, expect } from "vitest"
import { xsampaToIpa } from "../ipa-from-xsampa"

const cp = (n: number) => String.fromCodePoint(n)

describe("xsampaToIpa", () => {
  it("converts single-symbol codes", () => {
    expect(xsampaToIpa("S")).toBe("ʃ")
    expect(xsampaToIpa("4")).toBe("ɾ")
    expect(xsampaToIpa("@")).toBe("ə")
    expect(xsampaToIpa("{")).toBe("æ")
  })

  it("takes the longest code at each position", () => {
    expect(xsampaToIpa("r\\`")).toBe("ɻ")
    expect(xsampaToIpa("r\\")).toBe("ɹ")
    expect(xsampaToIpa("r`")).toBe("ɽ")
    expect(xsampaToIpa("@\\")).toBe("ɘ")
    expect(xsampaToIpa("J\\_<")).toBe("ʄ")
    expect(xsampaToIpa("G\\_<")).toBe("ʛ")
    expect(xsampaToIpa("v\\")).toBe("ʋ")
    expect(xsampaToIpa("I\\")).toBe("ᵻ")
  })

  it("never re-reads its own output", () => {
    // "@" + stress mark must not fuse into a different vowel.
    expect(xsampaToIpa('"@')).toBe("ˈə")
    // n_d (dental n) followed by Z stays three symbols.
    expect(xsampaToIpa("n_dZ")).toBe(`n${cp(0x32a)}ʒ`)
  })

  it("handles diacritics, length and stress", () => {
    expect(xsampaToIpa("t_h")).toBe("tʰ")
    expect(xsampaToIpa("a:")).toBe("aː")
    expect(xsampaToIpa('"kas%ta')).toBe("ˈkasˌta")
    expect(xsampaToIpa("a~")).toBe(`a${cp(0x303)}`)
    expect(xsampaToIpa("a_~")).toBe(`a${cp(0x303)}`)
    expect(xsampaToIpa("n_0")).toBe(`n${cp(0x325)}`)
    expect(xsampaToIpa("u_}")).toBe(`u${cp(0x31a)}`)
    expect(xsampaToIpa("k_>")).toBe("kʼ")
  })

  it("only adds a tie bar where one is written", () => {
    expect(xsampaToIpa("kats")).toBe("kats")
    expect(xsampaToIpa("t_S")).toBe(`t${cp(0x361)}ʃ`)
  })

  it("converts clicks and tone letters", () => {
    expect(xsampaToIpa("|\\|\\")).toBe("ǁ")
    expect(xsampaToIpa("!\\")).toBe("ǃ")
    expect(xsampaToIpa("^")).toBe("ꜛ")
    expect(xsampaToIpa("!")).toBe("ꜜ")
  })

  it("leaves already-IPA text alone", () => {
    const ipa = "ˈʃɛlˌtər"
    expect(xsampaToIpa(ipa)).toBe(ipa)
    expect(xsampaToIpa(xsampaToIpa('"S@4t'))).toBe(xsampaToIpa('"S@4t'))
  })
})
