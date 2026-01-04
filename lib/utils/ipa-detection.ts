/**
 * Detects if a string looks like IPA notation
 * IPA is typically wrapped in slashes like /ipa/ or contains IPA characters
 */
export function looksLikeIPA(text: string): boolean {
  if (!text || typeof text !== "string") {
    return false
  }

  const trimmed = text.trim()

  // Check if wrapped in slashes (common IPA notation)
  if (/^\/.+\/$/.test(trimmed)) {
    return true
  }

  // Check for common IPA characters (basic heuristic)
  // IPA contains many Unicode characters, so this is a basic check
  const ipaPattern = /[ɑæəɐɓɕɖɗɘɚɜɝɞɟɠɡɢɣɤɥɦɧɨɩɪɫɬɭɮɯɰɱɲɳɴɵɶɷɸɹɺɻɼɽɾɿʀʁʂʃʄʅʆʇʈʉʊʋʌʍʎʏʐʑʒʓʔʕʖʗʘʙʚʛʜʝʞʟʠʡʢʣʤʥʦʧʨʩʪʫʬʭʮʯ]/
  
  // Also check for stress marks, length marks, etc.
  const ipaDiacritics = /[ːˑˈˌ‿͜͡]/
  
  return ipaPattern.test(trimmed) || ipaDiacritics.test(trimmed)
}

/**
 * Extracts IPA from a string, removing slashes if present
 */
export function extractIPA(text: string): string {
  if (!text) return ""
  
  // Remove leading/trailing slashes
  return text.replace(/^\/|\/$/g, "").trim()
}

