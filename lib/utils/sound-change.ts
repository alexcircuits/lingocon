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
  "ⱱ", "ɾ", "ɽ",
  // Fricatives
  "ɸ", "β", "f", "v", "θ", "ð", "s", "z", "ʃ", "ʒ", "ʂ", "ʐ",
  "ç", "ʝ", "x", "ɣ", "χ", "ʁ", "ħ", "ʕ", "h", "ɦ",
  "ɕ", "ʑ", "ʍ", "ɧ",
  // Lateral fricatives
  "ɬ", "ɮ",
  // Affricates
  "ts", "dz", "tʃ", "dʒ", "tɕ", "dʑ", "ʈʂ", "ɖʐ", "pf", "bv", "kx",
  // Approximants
  "ʋ", "ɹ", "ɻ", "j", "ɰ", "w", "ɥ",
  // Lateral approximants
  "l", "ɭ", "ʎ", "ʟ",
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

/**
 * Convert an environment string to a regex pattern.
 * Handles: V (vowel), C (consonant), # (boundary), literal characters
 */
function envToRegex(env: string, vowels: Set<string>, consonants: Set<string>): string {
  if (!env || env === "_") return ""

  let pattern = ""
  for (let i = 0; i < env.length; i++) {
    const ch = env[i]
    if (ch === "#") {
      // Word boundary
      pattern += "(?:^|$)"
    } else if (ch === "V") {
      // Any vowel
      const vowelList = Array.from(vowels).sort((a, b) => b.length - a.length)
      pattern += `(?:${vowelList.map(escapeRegex).join("|")})`
    } else if (ch === "C") {
      // Any consonant
      const consList = Array.from(consonants).sort((a, b) => b.length - a.length)
      pattern += `(?:${consList.map(escapeRegex).join("|")})`
    } else if (ch === ".") {
      // Any single character
      pattern += "."
    } else {
      pattern += escapeRegex(ch)
    }
  }
  return pattern
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
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

  // Split on arrow: →, >, ->
  const arrowMatch = trimmed.match(/^(.+?)(?:→|->|>)(.+)$/)
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
  if (!rule.enabled) return word

  const leftPattern = envToRegex(rule.leftEnv, vowels, consonants)
  const rightPattern = envToRegex(rule.rightEnv, vowels, consonants)
  const targetPattern = escapeRegex(rule.target)

  // Handle word-boundary in environments
  let left = leftPattern.replace(/\(\?:\^\|\$\)/g, "")
  let right = rightPattern.replace(/\(\?:\^\|\$\)/g, "")

  // Determine if boundaries are specified
  const leftBoundary = rule.leftEnv.includes("#")
  const rightBoundary = rule.rightEnv.includes("#")

  // Build full regex
  let fullPattern: string
  if (leftBoundary && rightBoundary) {
    fullPattern = `^(${left})(${targetPattern})(${right})$`
  } else if (leftBoundary) {
    fullPattern = `^(${left})(${targetPattern})(${right})`
  } else if (rightBoundary) {
    fullPattern = `(${left})(${targetPattern})(${right})$`
  } else {
    fullPattern = `(${left})(${targetPattern})(${right})`
  }

  try {
    const regex = new RegExp(fullPattern, "g")
    return word.replace(regex, (match, ...groups) => {
      // groups[0] = left env, groups[1] = target, groups[2] = right env
      const leftMatch = groups[0] || ""
      const rightMatch = groups[2] || ""
      return leftMatch + rule.replacement + rightMatch
    })
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
