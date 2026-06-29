/**
 * Sound Change Pipeline Engine
 *
 * Parses and applies phonological rules using standard linguistic notation:
 *   target → replacement / left_environment _ right_environment
 *
 * Examples:
 *   a → e / _#          (a becomes e word-finally)
 *   k → tʃ / _i         (k becomes tʃ before i)
 *   s → ∅ / V_V         (s is deleted between vowels)
 *   b → p / #_           (b becomes p word-initially)
 *
 * Special symbols:
 *   # = word boundary
 *   V = any vowel
 *   C = any consonant
 *   ∅ (or 0) = deletion
 *   _ = position of the target
 */

// Default phoneme classes — comprehensive IPA inventory
const DEFAULT_VOWELS = new Set([
  // Close
  "i", "y", "ɨ", "ʉ", "ɯ", "u",
  // Near-close
  "ɪ", "ʏ", "ʊ",
  // Close-mid
  "e", "ø", "ɘ", "ɵ", "ɤ", "o",
  // Mid
  "ə", "e̞", "ø̞", "ɤ̞", "o̞",
  // Open-mid
  "ɛ", "œ", "ɜ", "ɞ", "ʌ", "ɔ",
  // Near-open
  "æ", "ɐ",
  // Open
  "a", "ɶ", "ä", "ɑ", "ɒ",
  // Nasalized
  "ã", "ẽ", "ĩ", "õ", "ũ",
  // Long
  "aː", "eː", "iː", "oː", "uː", "ɛː", "ɔː", "æː", "ɑː",
  // Rhoticized
  "ɚ", "ɝ",
])

const DEFAULT_CONSONANTS = new Set([
  // Plosives
  "p", "b", "t", "d", "ʈ", "ɖ", "c", "ɟ", "k", "g", "ɡ", "q", "ɢ", "ʔ", "ʡ",
  // Nasals
  "m", "ɱ", "n", "ɳ", "ɲ", "ŋ", "ɴ",
  // Trills
  "ʙ", "r", "ʀ", "ʜ", "ʢ",
  // Taps/Flaps
  "ⱱ", "ɾ", "ɽ", "ɺ",
  // Fricatives
  "ɸ", "β", "f", "v", "θ", "ð", "s", "z", "ʃ", "ʒ", "ʂ", "ʐ",
  "ç", "ʝ", "x", "ɣ", "χ", "ʁ", "ħ", "ʕ", "h", "ɦ",
  "ɕ", "ʑ", "ʍ", "ɧ", "ɼ",
  // Lateral fricatives
  "ɬ", "ɮ",
  // Affricates
  "ts", "dz", "tʃ", "dʒ", "tɕ", "dʑ", "ʈʂ", "ɖʐ", "pf", "bv", "kx", "gɣ", "ɡɣ",
  // Approximants
  "ʋ", "ɹ", "ɻ", "j", "ɰ", "w", "ɥ",
  // Lateral approximants
  "l", "ɫ", "ɭ", "ʎ", "ʟ",
  // Implosives
  "ɓ", "ɗ", "ʄ", "ɠ", "ʛ",
])

export interface SoundChangeRule {
  id: string
  /** Raw text of the rule, e.g. "a → e / _#" */
  raw: string
  /** The target segment(s) to match */
  target: string
  /** The replacement (empty string for deletion) */
  replacement: string
  /** Left environment regex pattern */
  leftEnv: string
  /** Right environment regex pattern */
  rightEnv: string
  /** Whether the rule is enabled */
  enabled: boolean
  /** Optional note / description */
  note?: string
}

export interface SoundChangeResult {
  original: string
  changed: string
  rulesApplied: string[]
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Build a `(?:…|…)` alternation for a phoneme class, longest-first so multi-char
 * phonemes (e.g. "aː", "tʃ") match before their single-char prefixes.
 *
 * Cached per Set: these alternations are ~50 entries each and were previously
 * rebuilt on every rule application — a hot path during `batchApply`.
 */
const classAlternationCache = new WeakMap<Set<string>, string>()

function classAlternation(set: Set<string>): string {
  const cached = classAlternationCache.get(set)
  if (cached) return cached
  const alt = Array.from(set)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join("|")
  const pattern = `(?:${alt})`
  classAlternationCache.set(set, pattern)
  return pattern
}

interface EnvPattern {
  /** Regex source for the environment's characters (no boundary anchor). */
  pattern: string
  /** Whether the environment requires a word boundary (#) at the word edge. */
  boundary: boolean
}

/**
 * Convert an environment string to a regex source plus a boundary flag.
 * Handles: V (vowel), C (consonant), # (boundary), . (any), literal characters.
 * The boundary position (start vs end) is applied by the caller so the result
 * can be used as a zero-width lookbehind (left) or lookahead (right).
 */
function envToPattern(env: string, vowels: Set<string>, consonants: Set<string>): EnvPattern {
  if (!env || env === "_") return { pattern: "", boundary: false }

  let pattern = ""
  let boundary = false
  for (const ch of env) {
    if (ch === "#") {
      boundary = true
    } else if (ch === "V") {
      pattern += classAlternation(vowels)
    } else if (ch === "C") {
      pattern += classAlternation(consonants)
    } else if (ch === ".") {
      pattern += "."
    } else {
      pattern += escapeRegex(ch)
    }
  }
  return { pattern, boundary }
}

/**
 * Parse a sound change rule from text.
 *
 * Formats supported:
 *   target → replacement / left _ right
 *   target > replacement / left _ right
 *   target -> replacement / left _ right
 *   target → replacement   (no environment = unconditional)
 */
export function parseRule(text: string, id?: string): SoundChangeRule | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) {
    return null // Comment or empty line
  }

  // Split on arrow. Accepts →, a single >, or one-or-more dashes/equals before
  // `>` so the natural ASCII forms `->`, `-->`, `==>` all work — plus the
  // en/em-dash variants (–> —>) macOS "smart dashes" can produce. The dash run
  // is matched as a unit so `-->` doesn't leave a stray `-` glued to the target.
  const arrowMatch = trimmed.match(/^(.+?)(?:→|[=–—-]+>|>)(.+)$/)
  if (!arrowMatch) return null

  const target = arrowMatch[1].trim()
  let rest = arrowMatch[2].trim()

  // Split on / for environment
  let replacement = ""
  let leftEnv = ""
  let rightEnv = ""

  const envSplit = rest.split("/")
  replacement = envSplit[0].trim()

  if (envSplit.length > 1) {
    const envPart = envSplit.slice(1).join("/").trim()
    const underscoreIdx = envPart.indexOf("_")
    if (underscoreIdx >= 0) {
      leftEnv = envPart.substring(0, underscoreIdx).trim()
      rightEnv = envPart.substring(underscoreIdx + 1).trim()
    }
  }

  // Handle deletion symbols
  if (replacement === "∅" || replacement === "0" || replacement === "Ø") {
    replacement = ""
  }

  return {
    id: id || crypto.randomUUID(),
    raw: trimmed,
    target,
    replacement,
    leftEnv,
    rightEnv,
    enabled: true,
  }
}

/**
 * Apply a single rule to a word.
 */
export function applyRule(
  word: string,
  rule: SoundChangeRule,
  vowels: Set<string> = DEFAULT_VOWELS,
  consonants: Set<string> = DEFAULT_CONSONANTS
): string {
  if (!rule.enabled || !rule.target) return word

  const left = envToPattern(rule.leftEnv, vowels, consonants)
  const right = envToPattern(rule.rightEnv, vowels, consonants)
  const target = `(?:${escapeRegex(rule.target)})`

  // Environments are expressed as ZERO-WIDTH assertions — a lookbehind for the
  // left context and a lookahead for the right — so only the target segment is
  // consumed. This is what makes adjacent/overlapping contexts work: a rule like
  // `s → ∅ / V_V` over "asasa" must delete BOTH intervocalic consonants, but a
  // regex that *consumes* the shared vowel can only match every other target.
  // `#` anchors to the word start (left) or end (right).
  const lookbehind =
    left.boundary && !left.pattern ? "^"
    : left.boundary ? `(?<=^${left.pattern})`
    : left.pattern ? `(?<=${left.pattern})`
    : ""

  const lookahead =
    right.boundary && !right.pattern ? "$"
    : right.boundary ? `(?=${right.pattern}$)`
    : right.pattern ? `(?=${right.pattern})`
    : ""

  try {
    const regex = new RegExp(`${lookbehind}${target}${lookahead}`, "g")
    return word.replace(regex, rule.replacement)
  } catch {
    // Invalid regex — return unchanged
    return word
  }
}

/**
 * Apply a pipeline of rules to a single word.
 * Rules are applied sequentially — order matters!
 */
export function applyPipeline(
  word: string,
  rules: SoundChangeRule[],
  vowels?: Set<string>,
  consonants?: Set<string>
): SoundChangeResult {
  let current = word
  const rulesApplied: string[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue
    const result = applyRule(current, rule, vowels, consonants)
    if (result !== current) {
      rulesApplied.push(rule.raw)
      current = result
    }
  }

  return {
    original: word,
    changed: current,
    rulesApplied,
  }
}

/**
 * Parse multiple rules from a text block (one per line).
 * Lines starting with // or # are comments and are skipped.
 */
export function parseRules(text: string): SoundChangeRule[] {
  return text
    .split("\n")
    .map((line, i) => parseRule(line, `rule-${i}`))
    .filter((r): r is SoundChangeRule => r !== null)
}

/**
 * Batch-apply a pipeline to multiple words.
 */
export function batchApply(
  words: string[],
  rules: SoundChangeRule[],
  vowels?: Set<string>,
  consonants?: Set<string>
): SoundChangeResult[] {
  return words.map(word => applyPipeline(word, rules, vowels, consonants))
}
