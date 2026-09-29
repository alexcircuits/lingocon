/**
 * Serializes structured data for `<script type="application/ld+json">`.
 *
 * `JSON.stringify` leaves `<` untouched, so a user-controlled string such as a language name of
 * `</script><script>…` would close the tag and run as markup. Escaping `<`, `>` and `&` as JSON
 * unicode escapes keeps the payload byte-for-byte equivalent JSON while making it inert HTML;
 * U+2028/2029 are escaped for older JS parsers.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}
