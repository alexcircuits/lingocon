/**
 * Parse CSV string into array of objects
 * Handles quoted fields, commas in fields, and newlines
 */
export function parseCSV(csv: string): Array<Record<string, string>> {
  const lines = csv.split("\n").filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []

  // Parse header
  const headers = parseCSVLine(lines[0])
  if (headers.length === 0) return []

  // Normalize header names (case-insensitive, trim whitespace)
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase())

  // Map common variations to standard field names
  const fieldMap: Record<string, string> = {
    lemma: "lemma",
    word: "lemma",
    headword: "lemma",
    gloss: "gloss",
    translation: "gloss",
    meaning: "gloss",
    ipa: "ipa",
    pronunciation: "ipa",
    "part of speech": "partOfSpeech",
    pos: "partOfSpeech",
    partofspeech: "partOfSpeech",
    notes: "notes",
    note: "notes",
    etymology: "notes",
  }

  // Find column indices
  const columnIndices: Record<string, number> = {}
  normalizedHeaders.forEach((header, index) => {
    const mappedField = fieldMap[header] || header
    if (!columnIndices[mappedField]) {
      columnIndices[mappedField] = index
    }
  })

  // Parse data rows
  const rows: Array<Record<string, string>> = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === 0) continue

    const row: Record<string, string> = {}
    Object.entries(columnIndices).forEach(([field, index]) => {
      if (index < values.length) {
        const value = values[index]?.trim() || ""
        row[field] = value
      }
    })

    // Only add rows that have at least lemma and gloss
    if (row.lemma && row.gloss) {
      rows.push(row)
    }
  }

  return rows
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote (double quote)
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      values.push(current)
      current = ""
    } else {
      current += char
    }
  }

  // Add last field
  values.push(current)

  return values
}

/**
 * Validate CSV data before import
 */
export function validateCSVData(
  rows: Array<Record<string, string>>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (rows.length === 0) {
    errors.push("CSV file is empty or has no valid rows")
    return { valid: false, errors }
  }

  // Check for required fields
  const hasLemma = rows.some((row) => row.lemma)
  const hasGloss = rows.some((row) => row.gloss)

  if (!hasLemma) {
    errors.push("CSV must contain a 'lemma' or 'word' column")
  }
  if (!hasGloss) {
    errors.push("CSV must contain a 'gloss' or 'translation' column")
  }

  // Check for empty required fields
  const emptyLemmas = rows.filter((row, index) => !row.lemma?.trim()).length
  const emptyGlosses = rows.filter((row, index) => !row.gloss?.trim()).length

  if (emptyLemmas > 0) {
    errors.push(`${emptyLemmas} row(s) have empty lemma fields`)
  }
  if (emptyGlosses > 0) {
    errors.push(`${emptyGlosses} row(s) have empty gloss fields`)
  }

  // Check for duplicates (warn, don't error) — case-sensitive
  const lemmaSet = new Set<string>()
  const duplicates: string[] = []
  rows.forEach((row) => {
    if (row.lemma) {
      const trimmed = row.lemma.trim()
      if (lemmaSet.has(trimmed)) {
        duplicates.push(row.lemma)
      }
      lemmaSet.add(trimmed)
    }
  })

  if (duplicates.length > 0) {
    errors.push(
      `Warning: ${duplicates.length} duplicate lemma(s) found (will be imported as separate entries)`
    )
  }

  return {
    valid: errors.length === 0 || errors.every((e) => e.startsWith("Warning:")),
    errors,
  }
}

