/**
 * Deterministic, ASCII-only, diff-friendly JSON for the Rust parity fixtures.
 *
 * - Every non-ASCII code unit is written as a `\uXXXX` escape (astral characters as surrogate
 *   pairs, which JSON and serde_json both decode back to the same code point). The fixtures are
 *   full of combining marks, BOMs, U+2028 and other characters that editors and git filters like
 *   to "fix"; escaping keeps the committed bytes immune to that.
 * - Containers whose members are all primitives are printed on one line, so a fixture diff shows
 *   one changed entry/warning per line instead of a wall of re-indented braces.
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

function isLeaf(value: Json): boolean {
  if (value === null || typeof value !== "object") return true
  const members = Array.isArray(value) ? value : Object.values(value)
  return members.every((member) => member === null || typeof member !== "object")
}

function asciiJson(value: Json): string {
  return JSON.stringify(value).replace(
    /[\u007f-￿]/g,
    (unit) => "\\u" + unit.charCodeAt(0).toString(16).padStart(4, "0")
  )
}

function render(value: Json, indent: string): string {
  if (value === null || typeof value !== "object" || isLeaf(value)) return asciiJson(value)
  const inner = indent + "  "
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]"
    return "[\n" + value.map((item) => inner + render(item, inner)).join(",\n") + "\n" + indent + "]"
  }
  const members = Object.entries(value)
  if (members.length === 0) return "{}"
  const body = members.map(([key, item]) => inner + asciiJson(key) + ": " + render(item, inner))
  return "{\n" + body.join(",\n") + "\n" + indent + "}"
}

/** Serialise `value` (plain JSON data only) as fixture text, with a trailing newline. */
export function toFixtureJson(value: unknown): string {
  // Round-trip through JSON first so `undefined` members and class instances can never leak in.
  const plain = JSON.parse(JSON.stringify(value)) as Json
  return render(plain, "") + "\n"
}
