"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AlertTriangle } from "lucide-react"

interface IGTBlockProps {
  sentence: string
  gloss: string
  translation: string
  onEdit?: (data: { sentence: string; gloss: string; translation: string }) => void
  editable?: boolean
}

// Leipzig Glossing Rules standard abbreviations
const LEIPZIG_ABBREVIATIONS: Record<string, string> = {
  SG: "Singular", PL: "Plural", DU: "Dual", INCL: "Inclusive", EXCL: "Exclusive",
  "1": "First person", "2": "Second person", "3": "Third person",
  "1SG": "First person singular", "2SG": "Second person singular", "3SG": "Third person singular",
  "1PL": "First person plural", "2PL": "Second person plural", "3PL": "Third person plural",
  NOM: "Nominative", ACC: "Accusative", GEN: "Genitive", DAT: "Dative",
  ABL: "Ablative", LOC: "Locative", INS: "Instrumental", VOC: "Vocative",
  ERG: "Ergative", ABS: "Absolutive",
  PAST: "Past tense", PRES: "Present tense", FUT: "Future tense",
  PERF: "Perfective", IMPERF: "Imperfective", PROG: "Progressive",
  SUBJ: "Subjunctive", OPT: "Optative", IMP: "Imperative",
  ACT: "Active", PASS: "Passive", CAUS: "Causative", REFL: "Reflexive",
  NEG: "Negation", INTERR: "Interrogative", COP: "Copula",
  DEF: "Definite", INDEF: "Indefinite",
  MASC: "Masculine", FEM: "Feminine", NEUT: "Neuter",
  INF: "Infinitive", PTCP: "Participle", GER: "Gerund",
  CONJ: "Conjunction", PREP: "Preposition", POSTP: "Postposition",
  "TOP": "Topic", "FOC": "Focus",
}

const MORPHEME_BOUNDARY_RE = /(-|=)/

/**
 * Split a word into morphemes, keeping the boundary character.
 * "mi-na-penda" → ["mi", "-", "na", "-", "penda"]
 */
function splitMorphemes(word: string): string[] {
  return word.split(MORPHEME_BOUNDARY_RE)
}

/** Check whether a gloss segment is a Leipzig abbreviation. */
function isAbbreviation(token: string): boolean {
  const clean = token.replace(/[^A-Z0-9]/g, "")
  return Boolean(LEIPZIG_ABBREVIATIONS[clean])
}

/** Tooltip label for a gloss token. */
function abbreviationLabel(token: string): string | undefined {
  const clean = token.replace(/[^A-Z0-9]/g, "")
  return LEIPZIG_ABBREVIATIONS[clean]
}

interface AlignedWord {
  native: string[]    // morpheme tokens (incl. boundary characters)
  gloss: string[]     // corresponding gloss tokens
  mismatch: boolean
}

/**
 * Pair native-script words with their gloss words, then pair
 * individual morphemes within each word.
 */
function buildAlignment(sentence: string, gloss: string): AlignedWord[] {
  const nativeWords = sentence.trim().split(/\s+/).filter(Boolean)
  const glossWords = gloss.trim().split(/\s+/).filter(Boolean)

  return nativeWords.map((nativeWord, i) => {
    const glossWord = glossWords[i] ?? ""
    const nativeMorphemes = splitMorphemes(nativeWord)
    const glossMorphemes = splitMorphemes(glossWord)

    // Check morpheme count (ignoring boundary tokens)
    const nativeCount = nativeMorphemes.filter(t => !MORPHEME_BOUNDARY_RE.test(t)).length
    const glossCount = glossMorphemes.filter(t => !MORPHEME_BOUNDARY_RE.test(t)).length

    return {
      native: nativeMorphemes,
      gloss: glossMorphemes,
      mismatch: glossWord !== "" && nativeCount !== glossCount,
    }
  })
}

function IGTWordColumn({ word }: { word: AlignedWord }) {
  // Zip native and gloss morphemes for rendering
  const nativeParts = word.native.filter(t => !MORPHEME_BOUNDARY_RE.test(t))
  const glossParts = word.gloss.filter(t => !MORPHEME_BOUNDARY_RE.test(t))
  const boundaries = word.native.filter(t => MORPHEME_BOUNDARY_RE.test(t))

  return (
    <div className="inline-flex flex-col items-start mr-4 last:mr-0">
      {/* Native script row */}
      <div className="font-mono font-custom-script-mono text-base leading-snug flex items-center">
        {word.native.map((token, i) =>
          MORPHEME_BOUNDARY_RE.test(token) ? (
            <span key={i} className="text-muted-foreground">{token}</span>
          ) : (
            <span key={i}>{token}</span>
          )
        )}
        {word.mismatch && (
          <span className="ml-1 text-amber-500" title="Morpheme count mismatch">
            <AlertTriangle className="h-3 w-3 inline" />
          </span>
        )}
      </div>

      {/* Gloss row */}
      <div className="font-mono text-sm text-muted-foreground leading-snug flex items-center">
        {word.gloss.map((token, i) => {
          if (MORPHEME_BOUNDARY_RE.test(token)) {
            return <span key={i} className="text-muted-foreground/60">{token}</span>
          }
          const isUpper = token === token.toUpperCase() && /[A-Z]/.test(token)
          const label = abbreviationLabel(token)
          return (
            <span
              key={i}
              title={label}
              className={isUpper && label ? "underline decoration-dotted cursor-help" : ""}
            >
              {token}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function IGTBlock({ sentence, gloss, translation, onEdit, editable = false }: IGTBlockProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [editSentence, setEditSentence] = useState(sentence)
  const [editGloss, setEditGloss] = useState(gloss)
  const [editTranslation, setEditTranslation] = useState(translation)

  const handleSave = () => {
    onEdit?.({ sentence: editSentence, gloss: editGloss, translation: editTranslation })
    setIsOpen(false)
  }

  const alignment = buildAlignment(sentence || "", gloss || "")
  const wordCountMismatch =
    (sentence || "").trim().split(/\s+/).filter(Boolean).length !==
    (gloss || "").trim().split(/\s+/).filter(Boolean).length &&
    (gloss || "").trim().length > 0

  const rendered = (
    <Card className={`p-4 ${editable && onEdit ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""}`}>
      {sentence ? (
        <>
          {/* Aligned interlinear display */}
          <div className="flex flex-wrap items-start gap-y-1 mb-2" aria-label="Interlinear gloss">
            {alignment.map((word, i) => (
              <IGTWordColumn key={i} word={word} />
            ))}
          </div>

          {wordCountMismatch && (
            <p className="text-xs text-amber-600 flex items-center gap-1 mb-2">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Word count mismatch between sentence and gloss line
            </p>
          )}

          {/* Free translation */}
          {translation && (
            <p className="text-sm italic text-foreground/80 border-t border-border/30 pt-2 mt-1">
              &lsquo;{translation}&rsquo;
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground italic">(empty IGT block)</p>
      )}

      {editable && onEdit && (
        <Badge variant="outline" className="mt-2 text-[10px] uppercase tracking-wider">
          IGT · click to edit
        </Badge>
      )}
    </Card>
  )

  if (!editable || !onEdit) return <div className="my-4">{rendered}</div>

  return (
    <div className="my-4">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>{rendered}</DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit IGT Block</DialogTitle>
            <DialogDescription>
              Interlinear Glossed Text — sentence, morpheme-by-morpheme gloss, free translation.
              Separate words with spaces; mark morpheme boundaries with hyphens (-) or equals (=).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="igt-sentence">Sentence</Label>
              <Input
                id="igt-sentence"
                value={editSentence}
                onChange={e => setEditSentence(e.target.value)}
                placeholder="mi-na-penda wewe"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="igt-gloss">
                Gloss
                <span className="ml-1 text-xs text-muted-foreground font-normal">
                  (morpheme-by-morpheme)
                </span>
              </Label>
              <Input
                id="igt-gloss"
                value={editGloss}
                onChange={e => setEditGloss(e.target.value)}
                placeholder="1SG-PAST-love 2SG"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="igt-translation">Free Translation</Label>
              <Input
                id="igt-translation"
                value={editTranslation}
                onChange={e => setEditTranslation(e.target.value)}
                placeholder="I loved you"
              />
            </div>

            {/* Live preview */}
            {(editSentence || editGloss) && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">Preview</p>
                <div className="flex flex-wrap gap-y-1">
                  {buildAlignment(editSentence, editGloss).map((word, i) => (
                    <IGTWordColumn key={i} word={word} />
                  ))}
                </div>
                {editTranslation && (
                  <p className="text-sm italic mt-2 text-foreground/80">&lsquo;{editTranslation}&rsquo;</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
