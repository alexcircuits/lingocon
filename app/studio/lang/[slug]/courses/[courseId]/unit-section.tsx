"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Loader2, Trash2, ChevronDown, Check, ChevronUp, Pencil,
} from "lucide-react"
import { updateUnit, deleteUnit } from "@/app/actions/learn"
import { toast } from "sonner"
import { LessonCard } from "./lesson-card"
import { AddLessonButtonForUnit } from "./add-buttons"
import type { Unit, Lesson, LessonItem, GrammarPage, TextItem } from "./types"

interface UnitSectionProps {
  unit: Unit
  index: number
  canMoveUp: boolean
  canMoveDown: boolean
  lessons: Lesson[]
  units: Unit[]
  expandedLessons: Set<string>
  onToggleLesson: (id: string) => void
  languageId: string
  slug: string
  grammarPages: GrammarPage[]
  texts: TextItem[]
  onMoveUnit: (dir: "up" | "down") => void
  onMoveLesson: (lessonId: string, dir: "up" | "down") => void
  onDeleteLesson: (lessonId: string) => void
  onItemAdded: (lessonId: string, item: LessonItem) => void
  onItemDeleted: (lessonId: string, itemId: string) => void
  onMoveItem: (lessonId: string, itemId: string, dir: "up" | "down") => void
  onUpdateLesson: (lessonId: string, data: { title?: string; description?: string | null }) => void
  onSetUnit: (lessonId: string, unitId: string | null) => void
  onLessonAdded: (lesson: Lesson) => void
  onUnitUpdated: (unit: Unit) => void
  onUnitDeleted: () => void
}

export function UnitSection({
  unit, index, canMoveUp, canMoveDown, lessons, units, expandedLessons, onToggleLesson,
  languageId, slug,
  grammarPages, texts,
  onMoveUnit, onMoveLesson,
  onDeleteLesson, onItemAdded, onItemDeleted, onMoveItem, onUpdateLesson, onSetUnit,
  onLessonAdded, onUnitUpdated, onUnitDeleted,
}: UnitSectionProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(unit.title)
  const [busy, setBusy] = useState(false)

  async function saveTitle() {
    const trimmed = title.trim()
    if (!trimmed || trimmed === unit.title) { setEditing(false); setTitle(unit.title); return }
    setBusy(true)
    const r = await updateUnit(unit.id, { title: trimmed })
    setBusy(false)
    if (r.data) {
      onUnitUpdated({ ...unit, title: trimmed })
      setEditing(false)
      toast.success("Unit renamed")
    } else {
      toast.error("Failed to rename")
    }
  }

  async function remove() {
    setBusy(true)
    const r = await deleteUnit(unit.id)
    setBusy(false)
    if (r.data) {
      onUnitDeleted()
      toast.success("Unit deleted")
    } else {
      toast.error("Failed to delete unit")
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary">
          Unit {index + 1}
        </span>
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setEditing(false); setTitle(unit.title) } }}
            />
            <Button size="sm" onClick={saveTitle} disabled={busy} className="gap-1">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ) : (
          <>
            <h3 className="flex-1 font-semibold">{unit.title}</h3>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" disabled={!canMoveUp} onClick={() => onMoveUnit("up")} aria-label="Move unit up">
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" disabled={!canMoveDown} onClick={() => onMoveUnit("down")} aria-label="Move unit down">
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={remove} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </>
        )}
      </div>

      <div className="space-y-3">
        {lessons.map((lesson, i) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            index={i}
            groupSize={lessons.length}
            units={units}
            expanded={expandedLessons.has(lesson.id)}
            onToggle={() => onToggleLesson(lesson.id)}
            languageId={languageId}
            slug={slug}
            grammarPages={grammarPages}
            texts={texts}
            onDelete={() => onDeleteLesson(lesson.id)}
            onItemAdded={(item) => onItemAdded(lesson.id, item)}
            onItemDeleted={(itemId) => onItemDeleted(lesson.id, itemId)}
            onMoveItem={(itemId, dir) => onMoveItem(lesson.id, itemId, dir)}
            onUpdateLesson={(data) => onUpdateLesson(lesson.id, data)}
            onSetUnit={(unitId) => onSetUnit(lesson.id, unitId)}
            onMove={(dir) => onMoveLesson(lesson.id, dir)}
          />
        ))}
        {lessons.length === 0 && (
          <p className="py-1 text-sm text-muted-foreground">No lessons in this unit yet.</p>
        )}
        <AddLessonButtonForUnit unitId={unit.id} onAdded={onLessonAdded} />
      </div>
    </div>
  )
}
