"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Loader2, Trash2, ChevronDown, ChevronRight, Check, Layers, Pencil,
} from "lucide-react"
import { updateLesson, deleteLessonItem } from "@/app/actions/learn"
import { toast } from "sonner"
import { MoveControls } from "./move-controls"
import { ItemRow } from "./item-row"
import { AddItemDialog } from "./add-item-dialog"
import type { Lesson, Unit, LessonItem, GrammarPage, TextItem } from "./types"

interface LessonCardProps {
  lesson: Lesson
  index: number
  groupSize: number
  units: Unit[]
  expanded: boolean
  languageId: string
  slug: string
  onToggle: () => void
  grammarPages: GrammarPage[]
  texts: TextItem[]
  onDelete: () => void
  onItemAdded: (item: LessonItem) => void
  onItemDeleted: (itemId: string) => void
  onMoveItem: (itemId: string, dir: "up" | "down") => void
  onUpdateLesson: (data: { title?: string; description?: string | null }) => void
  onSetUnit: (unitId: string | null) => void
  onMove: (dir: "up" | "down") => void
}

export function LessonCard({
  lesson, index, groupSize, units, expanded, onToggle,
  languageId, slug,
  grammarPages, texts,
  onDelete, onItemAdded, onItemDeleted, onMoveItem, onUpdateLesson, onSetUnit, onMove,
}: LessonCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState(lesson.title)
  const [editDesc, setEditDesc] = useState(lesson.description ?? "")
  const [busy, setBusy] = useState(false)

  async function saveTitle() {
    const trimmed = editTitle.trim()
    if (!trimmed) return
    if (trimmed === lesson.title && editDesc.trim() === (lesson.description ?? "")) {
      setEditingTitle(false)
      return
    }
    setBusy(true)
    const r = await updateLesson(lesson.id, { title: trimmed, description: editDesc.trim() || null })
    setBusy(false)
    if (r.data) {
      onUpdateLesson({ title: trimmed, description: editDesc.trim() || null })
      setEditingTitle(false)
      toast.success("Lesson updated")
    } else {
      toast.error("Failed to update lesson")
    }
  }

  const sortedItems = [...lesson.items].sort((a, b) => a.order - b.order)

  return (
    <div className="flex items-stretch gap-2">
      <MoveControls canUp={index > 0} canDown={index < groupSize - 1} onMove={onMove} label="lesson" />
      <Card className="flex-1 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center">
          <button
            className="flex-1 flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/40 transition-colors min-w-0"
            onClick={onToggle}
          >
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium">{lesson.title}</span>
              {lesson.description && (
                <span className="ml-2 text-xs text-muted-foreground">{lesson.description}</span>
              )}
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">{lesson.items.length} items</Badge>
            {expanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            }
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 mr-1 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setEditTitle(lesson.title)
              setEditDesc(lesson.description ?? "")
              setEditingTitle(true)
            }}
            aria-label="Edit lesson title"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Inline title edit */}
        {editingTitle && (
          <div className="px-4 py-3 space-y-2 border-t border-border/40 bg-secondary/20">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              autoFocus
              placeholder="Lesson title"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle()
                if (e.key === "Escape") setEditingTitle(false)
              }}
            />
            <Textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveTitle} disabled={busy || !editTitle.trim()} className="gap-1">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingTitle(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {expanded && (
          <CardContent className="pt-0 border-t border-border/40">
            <div className="pt-3 space-y-1.5">
              {sortedItems.map((item, i) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  canUp={i > 0}
                  canDown={i < sortedItems.length - 1}
                  onMove={(dir) => onMoveItem(item.id, dir)}
                  onDelete={async () => {
                    const r = await deleteLessonItem(item.id)
                    if (r.data) onItemDeleted(item.id)
                  }}
                />
              ))}
              {lesson.items.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">No items yet — add content below.</p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <AddItemDialog
                lessonId={lesson.id}
                languageId={languageId}
                slug={slug}
                grammarPages={grammarPages}
                texts={texts}
                onAdded={onItemAdded}
              />
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <Select
                  value={lesson.unitId ?? "none"}
                  onValueChange={(v) => onSetUnit(v === "none" ? null : v)}
                >
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder="No unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No unit</SelectItem>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-destructive hover:text-destructive ml-auto"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true)
                  await onDelete()
                  setDeleting(false)
                }}
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete Lesson
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
