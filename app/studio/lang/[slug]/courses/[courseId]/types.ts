// Shared types for the course editor and its extracted parts.

export interface DictEntry {
  id: string
  lemma: string
  gloss: string
  partOfSpeech: string | null
}

export interface GrammarPage {
  id: string
  title: string
}

export interface TextItem {
  id: string
  title: string
}

export interface SentenceOption {
  id: string
  sentence: string
  translation: string
}

export interface LessonItem {
  id: string
  type: string
  order: number
  dictEntry?: { id: string; lemma: string; gloss: string; partOfSpeech: string | null } | null
  grammarPage?: { id: string; title: string } | null
  text?: { id: string; title: string } | null
  sentence?: { id: string; sentence: string; translation: string } | null
}

export interface Lesson {
  id: string
  title: string
  description: string | null
  order: number
  unitId: string | null
  items: LessonItem[]
}

export interface Unit {
  id: string
  title: string
  description: string | null
  order: number
}

export interface Course {
  id: string
  title: string
  description: string | null
  visibility: string
  units: Unit[]
  lessons: Lesson[]
}

export type ItemType = "VOCAB" | "GRAMMAR" | "TEXT" | "SENTENCE"
