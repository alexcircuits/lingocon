const BLANK = "____"

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Blank every whole-word occurrence of `lemma` in `sentence` with "____".
 * Whole-word + case-insensitive; global so repeated occurrences don't leak
 * the answer. Returns null if the lemma does not appear as a whole word.
 */
export function blankWholeWord(sentence: string, lemma: string): string | null {
  const pattern = `(^|\\s)(${escapeRegExp(lemma)})(?=\\s|$|[.,!?;:])`
  // A fresh regex for the presence check — a global regex's lastIndex advances
  // on .test(), so it must not be shared with the .replace() call below.
  if (!new RegExp(pattern, "gi").test(sentence)) return null
  return sentence.replace(new RegExp(pattern, "gi"), (_m, pre) => `${pre}${BLANK}`)
}
