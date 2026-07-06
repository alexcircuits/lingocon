export interface AnkiCard {
  front: string
  back: string
}

export interface DeckEntry {
  lemma: string
  gloss: string
  ipa?: string | null
  partOfSpeech?: string | null
}

/**
 * Build a 2-field Anki deck (front = conlang lemma, back = meaning).
 * Back combines gloss with optional IPA and part-of-speech so a plain
 * front/back Anki import produces a useful card. Entries without a lemma or
 * gloss are skipped (an Anki card needs both sides).
 */
export function toAnkiCards(entries: DeckEntry[]): AnkiCard[] {
  const cards: AnkiCard[] = []
  for (const e of entries) {
    const front = e.lemma?.trim() ?? ""
    const gloss = e.gloss?.trim() ?? ""
    if (!front || !gloss) continue
    let back = gloss
    if (e.ipa && e.ipa.trim()) back += ` /${e.ipa.trim()}/`
    if (e.partOfSpeech && e.partOfSpeech.trim()) back += ` · ${e.partOfSpeech.trim()}`
    cards.push({ front, back })
  }
  return cards
}
