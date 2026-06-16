"use client"

import { useState } from "react"
import {
  Loader2, BookOpen, FileText, MessageSquare, Type, Trash2,
} from "lucide-react"
import { MoveControls } from "./move-controls"
import type { LessonItem } from "./types"

export function ItemRow({
  item, canUp, canDown, onMove, onDelete,
}: {
  item: LessonItem
  canUp: boolean
  canDown: boolean
  onMove: (dir: "up" | "down") => void
  onDelete: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  const label =
    item.type === "VOCAB"    && item.dictEntry   ? `${item.dictEntry.lemma} — ${item.dictEntry.gloss}`
    : item.type === "GRAMMAR"  && item.grammarPage ? item.grammarPage.title
    : item.type === "TEXT"     && item.text        ? item.text.title
    : item.type === "SENTENCE" && item.sentence    ? item.sentence.sentence
    : "Unknown item"

  const sublabel =
    item.type === "SENTENCE" && item.sentence    ? item.sentence.translation
    : item.type === "VOCAB"  && item.dictEntry?.partOfSpeech ? item.dictEntry.partOfSpeech
    : null

  const icon =
    item.type === "VOCAB"    ? <Type className="h-3.5 w-3.5 text-primary" />
    : item.type === "GRAMMAR"  ? <BookOpen className="h-3.5 w-3.5 text-amber-500" />
    : item.type === "TEXT"     ? <FileText className="h-3.5 w-3.5 text-blue-500" />
    : <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />

  return (
    <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 bg-secondary/50 group">
      <MoveControls canUp={canUp} canDown={canDown} onMove={onMove} label="item" />
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <span className="text-sm truncate block">{label}</span>
        {sublabel && <span className="text-xs text-muted-foreground truncate block">{sublabel}</span>}
      </div>
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 p-1"
        onClick={async () => {
          setDeleting(true)
          await onDelete()
          setDeleting(false)
        }}
        disabled={deleting}
        aria-label="Remove item"
      >
        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}
