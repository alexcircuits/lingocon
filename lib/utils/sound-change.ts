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
 * Cache of user-class-name lists sorted longest-first, keyed by the Map
 * instance. Mirrors `classAlternationCache`: names are recomputed once per
 * distinct classes Map rather than on every `envToPattern` call.
 */
const sortedClassNamesCache = new WeakMap<Map<string, Set<string>>, string[]>()

function sortedClassNames(classes: Map<string, Set<string>>): string[] {
  const cached = sortedClassNamesCache.get(classes)
  if (cached) return cached
  const names = Array.from(classes.keys()).sort((a, b) => b.length - a.length)
  sortedClassNamesCache.set(classes, names)
  return names
}

/**
 * Convert an environment string to a regex source plus a boundary flag.
 * Handles: V (vowel), C (consonant), # (boundary), . (any), user-defined
 * named classes, literal characters.
 *
 * User class names are multi-char, so this can't be a naive per-char loop
 * for them: we walk the env string with a cursor and, at each position, try
 * every registered class name (longest first) as a literal prefix match
 * before falling back to the single-char built-in handling. This guarantees
 * a class named "KW" is consumed as one token rather than "K" + literal "W"
 * when both "K" and "KW" are defined.
 *
 * The boundary position (start vs end) is applied by the caller so the
 * result can be used as a zero-width lookbehind (left) or lookahead (right).
 */
function envToPattern(
  env: string,
  vowels: Set<string>,
  consonants: Set<string>,
  classes?: Map<string, Set<string>>
): EnvPattern {
  if (!env || env === "_") return { pattern: "", boundary: false }

  const names = classes && classes.size > 0 ? sortedClassNames(classes) : []

  let pattern = ""
  let boundary = false
  let i = 0
  outer: while (i < env.length) {
    for (const name of names) {
      if (env.startsWith(name, i)) {
        pattern += classAlternation(classes!.get(name)!)
        i += name.length
        continue outer
      }
    }

    const ch = env[i]
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
    i += 1
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
  consonants: Set<string> = DEFAULT_CONSONANTS,
  classes?: Map<string, Set<string>>
): string {
  if (!rule.enabled || !rule.target) return word

  const left = envToPattern(rule.leftEnv, vowels, consonants, classes)
  const right = envToPattern(rule.rightEnv, vowels, consonants, classes)
  const targetClass = classes?.get(rule.target)
  const target = targetClass ? classAlternation(targetClass) : `(?:${escapeRegex(rule.target)})`

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
  consonants?: Set<string>,
  classes?: Map<string, Set<string>>
): SoundChangeResult {
  let current = word
  const rulesApplied: string[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue
    const result = applyRule(current, rule, vowels, consonants, classes)
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
  consonants?: Set<string>,
  classes?: Map<string, Set<string>>
): SoundChangeResult[] {
  return words.map(word => applyPipeline(word, rules, vowels, consonants, classes))
}

/**
 * A parsed rule-set source: user-defined named sound classes plus the
 * ordered rules that reference them (or don't).
 */
export interface SoundChangeProgram {
  classes: Map<string, Set<string>>
  rules: SoundChangeRule[]
}

/** Identifier for a class name: a non-empty run of letters only. */
const CLASS_NAME_RE = /^[A-Za-z]+$/

/** Class names "V" and "C" are reserved — built-in vowel/consonant tokens take precedence. */
const RESERVED_CLASS_NAMES = new Set(["V", "C"])

/**
 * Parse a single `class NAME = m1 m2 m3` definition line.
 * Returns null for anything else, including malformed class lines, so
 * callers can fall through to `parseRule`.
 */
function parseClassLine(line: string): { name: string; members: Set<string> } | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const prefix = "class "
  if (!trimmed.startsWith(prefix)) return null
  const rest = trimmed.slice(prefix.length)

  const eq = rest.indexOf("=")
  if (eq < 0) return null

  const name = rest.slice(0, eq).trim()
  if (!name || !CLASS_NAME_RE.test(name) || RESERVED_CLASS_NAMES.has(name)) return null

  const members = rest
    .slice(eq + 1)
    .split(/\s+/)
    .map(m => m.trim())
    .filter(m => m.length > 0)
  if (members.length === 0) return null

  return { name, members: new Set(members) }
}

/**
 * Parse a rule-set source into user-defined named sound classes plus the
 * ordered rules that reference them (or don't). Lines of the form
 * `class NAME = m1 m2 m3` are collected into `classes` (last definition wins
 * on duplicate names); every other line is parsed with the existing
 * `parseRule`, exactly as `parseRules` already does, so class-free text
 * produces `rules` identical to `parseRules`.
 */
export function parseProgram(text: string): SoundChangeProgram {
  const classes = new Map<string, Set<string>>()
  const rules: SoundChangeRule[] = []

  text.split("\n").forEach((line, i) => {
    const classDef = parseClassLine(line)
    if (classDef) {
      classes.set(classDef.name, classDef.members)
      return
    }
    const rule = parseRule(line, `rule-${i}`)
    if (rule) rules.push(rule)
  })

  return { classes, rules }
}
