"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import {
  GraduationCap, Plus, Trash2, Eye, EyeOff, Loader2,
  BookOpen, FileText, MessageSquare, Type, ChevronDown, ChevronRight, Check,
  FolderPlus, Layers, Pencil, ChevronUp, ExternalLink, Search, X,
} from "lucide-react"
import {
  createLesson, createLessonInUnit, addLessonItem, deleteLessonItem, deleteLesson, updateCourse,
  createUnit, updateUnit, deleteUnit, setLessonUnit, reorderLessons, reorderUnits,
  updateLesson, reorderLessonItems, createAndAddSentence, createAndAddVocab,
  searchDictEntries, searchCourseSentences,
} from "@/app/actions/learn"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/** Move an array element from one index to another (returns a new array). */
function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

interface DictEntry   { id: string; lemma: string; gloss: string; partOfSpeech: string | null }
interface GrammarPage { id: string; title: string }
interface TextItem    { id: string; title: string }
interface SentenceOption { id: string; sentence: string; translation: string }
interface LessonItem  {
  id: string; type: string; order: number
  dictEntry?:   { id: string; lemma: string; gloss: string; partOfSpeech: string | null } | null
  grammarPage?: { id: string; title: string } | null
  text?:        { id: string; title: string } | null
  sentence?:    { id: string; sentence: string; translation: string } | null
}
interface Lesson {
  id: string; title: string; description: string | null; order: number; unitId: string | null
  items: LessonItem[]
}
interface Unit {
  id: string; title: string; description: string | null; order: number
}
interface Course {
  id: string; title: string; description: string | null; visibility: string
  units: Unit[]
  lessons: Lesson[]
}

interface Props {
  course: Course
  language: { id: string; name: string; slug: string }
  grammarPages: GrammarPage[]
  texts: TextItem[]
  slug: string
}

type ItemType = "VOCAB" | "GRAMMAR" | "TEXT" | "SENTENCE"

// ── Course editor (root) ──────────────────────────────────────────────────────

export function CourseEditor({ course: initialCourse, language, grammarPages, texts, slug }: Props) {
  const [course, setCourse] = useState(initialCourse)

  // Visibility
  const [savingVisibility, setSavingVisibility] = useState(false)

  // Inline course header editing
  const [editingHeader, setEditingHeader] = useState(false)
  const [editTitle, setEditTitle] = useState(initialCourse.title)
  const [editDesc, setEditDesc] = useState(initialCourse.description ?? "")
  const [savingHeader, setSavingHeader] = useState(false)

  // Lesson expansion state
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set())

  function toggleLesson(id: string) {
    setExpandedLessons(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleVisibilityToggle() {
    setSavingVisibility(true)
    const next = course.visibility === "PUBLISHED" ? "DRAFT" : "PUBLISHED"
    try {
      const result = await updateCourse(course.id, { visibility: next })
      if (result.data) {
        setCourse(prev => ({ ...prev, visibility: next }))
        toast.success(next === "PUBLISHED" ? "Course published" : "Moved to draft")
      }
    } catch {
      toast.error("Failed to update")
    } finally {
      setSavingVisibility(false)
    }
  }

  async function handleSaveHeader() {
    const title = editTitle.trim()
    if (!title) return
    setSavingHeader(true)
    try {
      const r = await updateCourse(course.id, { title, description: editDesc.trim() || undefined })
      if (r.data) {
        setCourse(prev => ({ ...prev, title, description: editDesc.trim() || null }))
        setEditingHeader(false)
        toast.success("Course updated")
      } else {
        toast.error("Failed to update course")
      }
    } catch {
      toast.error("Failed to update course")
    } finally {
      setSavingHeader(false)
    }
  }

  function handleUpdateLesson(lessonId: string, data: { title?: string; description?: string | null }) {
    setCourse(prev => ({
      ...prev,
      lessons: prev.lessons.map(l => l.id === lessonId ? { ...l, ...data } : l),
    }))
  }

  async function handleMoveItem(lessonId: string, itemId: string, dir: "up" | "down") {
    const lesson = course.lessons.find(l => l.id === lessonId)
    if (!lesson) return
    const sorted = [...lesson.items].sort((a, b) => a.order - b.order)
    const ids = sorted.map(i => i.id)
    const idx = ids.indexOf(itemId)
    const target = dir === "up" ? idx - 1 : idx + 1
    if (idx < 0 || target < 0 || target >= ids.length) return
    const newIds = arrayMove(ids, idx, target)
    const orderMap = new Map(newIds.map((id, i) => [id, i]))
    setCourse(prev => ({
      ...prev,
      lessons: prev.lessons.map(l =>
        l.id === lessonId
          ? { ...l, items: l.items.map(i => orderMap.has(i.id) ? { ...i, order: orderMap.get(i.id)! } : i) }
          : l
      ),
    }))
    const r = await reorderLessonItems(lessonId, newIds)
    if (r.error) toast.error("Failed to reorder items")
  }

  const unitsSorted = [...course.units].sort((a, b) => a.order - b.order)
  const lessonsForUnit = (unitId: string) =>
    course.lessons.filter(l => l.unitId === unitId).sort((a, b) => a.order - b.order)
  const looseLessons = course.lessons.filter(l => !l.unitId).sort((a, b) => a.order - b.order)

  async function handleDeleteLesson(lessonId: string) {
    const r = await deleteLesson(lessonId)
    if (r.data) {
      setCourse(prev => ({ ...prev, lessons: prev.lessons.filter(l => l.id !== lessonId) }))
      toast.success("Lesson deleted")
    }
  }

  function handleItemAdded(lessonId: string, item: LessonItem) {
    setCourse(prev => ({
      ...prev,
      lessons: prev.lessons.map(l => (l.id === lessonId ? { ...l, items: [...l.items, item] } : l)),
    }))
  }

  function handleItemDeleted(lessonId: string, itemId: string) {
    setCourse(prev => ({
      ...prev,
      lessons: prev.lessons.map(l =>
        l.id === lessonId ? { ...l, items: l.items.filter(i => i.id !== itemId) } : l,
      ),
    }))
  }

  async function handleSetLessonUnit(lessonId: string, unitId: string | null) {
    setCourse(prev => ({
      ...prev,
      lessons: prev.lessons.map(l => (l.id === lessonId ? { ...l, unitId } : l)),
    }))
    const r = await setLessonUnit(lessonId, unitId)
    if (r.error) toast.error("Failed to move lesson")
  }

  async function handleMoveLesson(lessonId: string, unitId: string | null, dir: "up" | "down") {
    const group = unitId ? lessonsForUnit(unitId) : looseLessons
    const ids = group.map(l => l.id)
    const idx = ids.indexOf(lessonId)
    const target = dir === "up" ? idx - 1 : idx + 1
    if (idx < 0 || target < 0 || target >= ids.length) return

    const newIds = arrayMove(ids, idx, target)
    const orderMap = new Map(newIds.map((id, i) => [id, i]))
    setCourse(prev => ({
      ...prev,
      lessons: prev.lessons.map(l => (orderMap.has(l.id) ? { ...l, order: orderMap.get(l.id)! } : l)),
    }))
    const r = await reorderLessons(course.id, newIds)
    if (r.error) toast.error("Failed to reorder lessons")
  }

  async function handleMoveUnit(unitId: string, dir: "up" | "down") {
    const ids = unitsSorted.map(u => u.id)
    const idx = ids.indexOf(unitId)
    const target = dir === "up" ? idx - 1 : idx + 1
    if (idx < 0 || target < 0 || target >= ids.length) return

    const newIds = arrayMove(ids, idx, target)
    const orderMap = new Map(newIds.map((id, i) => [id, i]))
    setCourse(prev => ({
      ...prev,
      units: prev.units.map(u => (orderMap.has(u.id) ? { ...u, order: orderMap.get(u.id)! } : u)),
    }))
    const r = await reorderUnits(course.id, newIds)
    if (r.error) toast.error("Failed to reorder units")
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <Badge
              variant="secondary"
              className={cn("gap-1 text-xs",
                course.visibility === "PUBLISHED"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600"
              )}
            >
              {course.visibility === "PUBLISHED" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {course.visibility.toLowerCase()}
            </Badge>
          </div>

          {editingHeader ? (
            <div className="space-y-2 mt-1">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-xl font-bold h-10 max-w-lg"
                autoFocus
                placeholder="Course title"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveHeader()
                  if (e.key === "Escape") {
                    setEditingHeader(false)
                    setEditTitle(course.title)
                    setEditDesc(course.description ?? "")
                  }
                }}
              />
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="text-sm max-w-lg"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveHeader} disabled={savingHeader || !editTitle.trim()} className="gap-1">
                  {savingHeader ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingHeader(false)
                    setEditTitle(course.title)
                    setEditDesc(course.description ?? "")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="group flex items-start gap-2 mt-1">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
                {course.description && <p className="text-muted-foreground text-sm mt-1">{course.description}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                onClick={() => {
                  setEditTitle(course.title)
                  setEditDesc(course.description ?? "")
                  setEditingHeader(true)
                }}
                aria-label="Edit course title"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{course.units.length} units</span>
            <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{course.lessons.length} lessons</span>
            <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{course.lessons.reduce((s, l) => s + l.items.length, 0)} items</span>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleVisibilityToggle}
            disabled={savingVisibility}
          >
            {savingVisibility
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : course.visibility === "PUBLISHED"
              ? <EyeOff className="h-4 w-4" />
              : <Eye className="h-4 w-4" />
            }
            {course.visibility === "PUBLISHED" ? "Unpublish" : "Publish"}
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/learn/${slug}/courses/${course.id}`} target="_blank" rel="noopener noreferrer">
              Preview
            </a>
          </Button>
        </div>
      </div>

      {/* Units → lessons */}
      <div className="space-y-6">
        {unitsSorted.map((unit, ui) => (
          <UnitSection
            key={unit.id}
            unit={unit}
            index={ui}
            canMoveUp={ui > 0}
            canMoveDown={ui < unitsSorted.length - 1}
            lessons={lessonsForUnit(unit.id)}
            units={unitsSorted}
            expandedLessons={expandedLessons}
            onToggleLesson={toggleLesson}
            languageId={language.id}
            slug={slug}
            grammarPages={grammarPages}
            texts={texts}
            onMoveUnit={(dir) => handleMoveUnit(unit.id, dir)}
            onMoveLesson={(lessonId, dir) => handleMoveLesson(lessonId, unit.id, dir)}
            onDeleteLesson={handleDeleteLesson}
            onItemAdded={handleItemAdded}
            onItemDeleted={handleItemDeleted}
            onMoveItem={handleMoveItem}
            onUpdateLesson={handleUpdateLesson}
            onSetUnit={handleSetLessonUnit}
            onLessonAdded={(lesson) => setCourse(prev => ({ ...prev, lessons: [...prev.lessons, lesson] }))}
            onUnitUpdated={(u) => setCourse(prev => ({ ...prev, units: prev.units.map(x => x.id === u.id ? { ...x, ...u } : x) }))}
            onUnitDeleted={() => setCourse(prev => ({
              ...prev,
              units: prev.units.filter(x => x.id !== unit.id),
              lessons: prev.lessons.map(l => l.unitId === unit.id ? { ...l, unitId: null } : l),
            }))}
          />
        ))}

        {/* Unassigned lessons */}
        {(looseLessons.length > 0 || unitsSorted.length === 0) && (
          <div className="space-y-3">
            {unitsSorted.length > 0 && (
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Layers className="h-4 w-4" />
                Lessons not in a unit
              </div>
            )}
            {looseLessons.map((lesson, i) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                index={i}
                groupSize={looseLessons.length}
                units={unitsSorted}
                expanded={expandedLessons.has(lesson.id)}
                onToggle={() => toggleLesson(lesson.id)}
                languageId={language.id}
                slug={slug}
                grammarPages={grammarPages}
                texts={texts}
                onDelete={() => handleDeleteLesson(lesson.id)}
                onItemAdded={(item) => handleItemAdded(lesson.id, item)}
                onItemDeleted={(itemId) => handleItemDeleted(lesson.id, itemId)}
                onMoveItem={(itemId, dir) => handleMoveItem(lesson.id, itemId, dir)}
                onUpdateLesson={(data) => handleUpdateLesson(lesson.id, data)}
                onSetUnit={(unitId) => handleSetLessonUnit(lesson.id, unitId)}
                onMove={(dir) => handleMoveLesson(lesson.id, null, dir)}
              />
            ))}
            <AddLessonButton
              courseId={course.id}
              unitId={null}
              onAdded={(lesson) => setCourse(prev => ({ ...prev, lessons: [...prev.lessons, lesson] }))}
            />
          </div>
        )}
      </div>

      <div className="mt-6">
        <AddUnitButton
          courseId={course.id}
          onAdded={(unit) => setCourse(prev => ({ ...prev, units: [...prev.units, unit] }))}
        />
      </div>
    </div>
  )
}

// ── Lesson card ───────────────────────────────────────────────────────────────

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

function LessonCard({
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

// ── Move controls ─────────────────────────────────────────────────────────────

function MoveControls({
  canUp, canDown, onMove, label,
}: {
  canUp: boolean
  canDown: boolean
  onMove: (dir: "up" | "down") => void
  label: string
}) {
  return (
    <div className="flex flex-col justify-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        disabled={!canUp}
        onClick={() => onMove("up")}
        aria-label={`Move ${label} up`}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        disabled={!canDown}
        onClick={() => onMove("down")}
        aria-label={`Move ${label} down`}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ── Item row ──────────────────────────────────────────────────────────────────

function ItemRow({
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

// ── Add item dialog ───────────────────────────────────────────────────────────

function AddItemDialog({
  lessonId, languageId, slug, grammarPages, texts, onAdded,
}: {
  lessonId: string
  languageId: string
  slug: string
  grammarPages: GrammarPage[]
  texts: TextItem[]
  onAdded: (item: LessonItem) => void
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<ItemType>("VOCAB")
  const [mode, setMode] = useState<"search" | "write">("search")
  const [loading, setLoading] = useState(false)

  // Server-fetched search results
  const [searchQuery, setSearchQuery] = useState("")
  const [vocabResults, setVocabResults] = useState<DictEntry[]>([])
  const [sentenceResults, setSentenceResults] = useState<SentenceOption[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedItem, setSelectedItem] = useState<{ id: string; data: DictEntry | SentenceOption | GrammarPage | TextItem } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Word picker for write-sentence mode (inline, async)
  const [wordPickerQuery, setWordPickerQuery] = useState("")
  const [wordPickerResults, setWordPickerResults] = useState<DictEntry[]>([])
  const [wordPickerOpen, setWordPickerOpen] = useState(false)
  const [sentDictEntry, setSentDictEntry] = useState<DictEntry | null>(null)

  // Write mode — sentence
  const [sentText, setSentText] = useState("")
  const [sentTranslation, setSentTranslation] = useState("")
  const [sentGloss, setSentGloss] = useState("")

  // Write mode — vocab
  const [vocabLemma, setVocabLemma] = useState("")
  const [vocabGloss, setVocabGloss] = useState("")
  const [vocabPos, setVocabPos] = useState("")

  // Load initial results when dialog opens or type changes
  const loadInitial = useCallback(async (t: ItemType) => {
    if (t === "VOCAB") {
      setIsSearching(true)
      const r = await searchDictEntries(languageId, "")
      setVocabResults(r)
      setIsSearching(false)
    } else if (t === "SENTENCE") {
      setIsSearching(true)
      const r = await searchCourseSentences(languageId, "")
      setSentenceResults(r)
      setIsSearching(false)
    }
  }, [languageId])

  useEffect(() => {
    if (!open) return
    loadInitial(type)
    // Focus search input
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (!open || mode !== "search") return
    if (type !== "VOCAB" && type !== "SENTENCE") return

    const timer = setTimeout(async () => {
      setIsSearching(true)
      if (type === "VOCAB") {
        const r = await searchDictEntries(languageId, searchQuery)
        setVocabResults(r)
      } else {
        const r = await searchCourseSentences(languageId, searchQuery)
        setSentenceResults(r)
      }
      setIsSearching(false)
    }, 280)
    return () => clearTimeout(timer)
  }, [searchQuery, type, open, mode, languageId])

  // Word picker search for write-sentence mode
  useEffect(() => {
    if (!wordPickerOpen) return
    const timer = setTimeout(async () => {
      const r = await searchDictEntries(languageId, wordPickerQuery)
      setWordPickerResults(r)
    }, 280)
    return () => clearTimeout(timer)
  }, [wordPickerQuery, wordPickerOpen, languageId])

  function handleTypeChange(newType: ItemType) {
    setType(newType)
    setMode("search")
    setSelectedItem(null)
    setSearchQuery("")
    loadInitial(newType)
  }

  function resetAll() {
    setType("VOCAB")
    setMode("search")
    setSelectedItem(null)
    setSearchQuery("")
    setVocabResults([])
    setSentenceResults([])
    setSentText("")
    setSentTranslation("")
    setSentGloss("")
    setSentDictEntry(null)
    setWordPickerQuery("")
    setWordPickerOpen(false)
    setVocabLemma("")
    setVocabGloss("")
    setVocabPos("")
  }

  // Static search for grammar/text (already loaded)
  const staticOptions: Array<{ id: string; label: string; sub?: string }> =
    type === "GRAMMAR"
      ? grammarPages
          .filter(p => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()))
          .map(p => ({ id: p.id, label: p.title }))
      : type === "TEXT"
      ? texts
          .filter(t => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()))
          .map(t => ({ id: t.id, label: t.title }))
      : []

  const dynamicOptions: Array<{ id: string; label: string; sub?: string }> =
    type === "VOCAB"
      ? vocabResults.map(e => ({ id: e.id, label: e.lemma, sub: `${e.gloss}${e.partOfSpeech ? ` · ${e.partOfSpeech}` : ""}` }))
      : type === "SENTENCE"
      ? sentenceResults.map(s => ({ id: s.id, label: s.sentence, sub: s.translation }))
      : []

  const listOptions = type === "GRAMMAR" || type === "TEXT" ? staticOptions : dynamicOptions

  async function handleAddExisting() {
    if (!selectedItem) return
    setLoading(true)
    try {
      const r = await addLessonItem(lessonId, type, selectedItem.id)
      if (r.data) {
        const d = selectedItem.data
        onAdded({
          id: r.data.id, type, order: r.data.order,
          dictEntry:   type === "VOCAB"    ? (d as DictEntry) : null,
          grammarPage: type === "GRAMMAR"  ? (d as GrammarPage) : null,
          text:        type === "TEXT"     ? (d as TextItem) : null,
          sentence:    type === "SENTENCE" ? (d as SentenceOption) : null,
        })
        resetAll()
        setOpen(false)
        toast.success("Item added")
      } else if (r.error) {
        toast.error(r.error)
      }
    } catch {
      toast.error("Failed to add item")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateSentence() {
    if (!sentText.trim() || !sentTranslation.trim() || !sentDictEntry) return
    setLoading(true)
    try {
      const r = await createAndAddSentence(lessonId, sentDictEntry.id, sentText.trim(), sentTranslation.trim(), sentGloss.trim() || undefined)
      if (r.data) {
        onAdded({
          id: r.data.item.id, type: "SENTENCE", order: r.data.item.order,
          dictEntry: null, grammarPage: null, text: null,
          sentence: r.data.sentence,
        })
        resetAll()
        setOpen(false)
        toast.success("Sentence created and added")
      } else if (r.error) {
        toast.error(r.error)
      }
    } catch {
      toast.error("Failed to create sentence")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateVocab() {
    if (!vocabLemma.trim() || !vocabGloss.trim()) return
    setLoading(true)
    try {
      const r = await createAndAddVocab(lessonId, languageId, vocabLemma.trim(), vocabGloss.trim(), vocabPos.trim() || undefined)
      if (r.data) {
        onAdded({
          id: r.data.item.id, type: "VOCAB", order: r.data.item.order,
          dictEntry: r.data.dictEntry, grammarPage: null, text: null, sentence: null,
        })
        resetAll()
        setOpen(false)
        toast.success("Word created and added")
      } else if (r.error) {
        toast.error(r.error)
      }
    } catch {
      toast.error("Failed to create word")
    } finally {
      setLoading(false)
    }
  }

  const canWrite = type === "VOCAB" || type === "SENTENCE"

  const submitDisabled = loading || (
    mode === "search"
      ? !selectedItem
      : type === "SENTENCE"
        ? (!sentText.trim() || !sentTranslation.trim() || !sentDictEntry)
        : (!vocabLemma.trim() || !vocabGloss.trim())
  )

  function handleSubmit() {
    if (mode === "search") return handleAddExisting()
    if (type === "SENTENCE") return handleCreateSentence()
    if (type === "VOCAB") return handleCreateVocab()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAll(); setOpen(o) }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Plus className="h-3.5 w-3.5" />
          Add Item
        </Button>
      </DialogTrigger>
      <DialogContent className="flex flex-col sm:max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Add Item to Lesson</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 min-h-0 flex-1">
          {/* Type selector */}
          <div className="grid grid-cols-4 gap-1.5 shrink-0">
            {([
              ["VOCAB",    "Vocab",    <Type key="v" className="h-3.5 w-3.5" />],
              ["GRAMMAR",  "Grammar",  <BookOpen key="g" className="h-3.5 w-3.5" />],
              ["TEXT",     "Text",     <FileText key="t" className="h-3.5 w-3.5" />],
              ["SENTENCE", "Sentence", <MessageSquare key="s" className="h-3.5 w-3.5" />],
            ] as [ItemType, string, React.ReactNode][]).map(([value, label, icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => handleTypeChange(value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border-2 py-2.5 px-1 text-xs font-medium transition-all",
                  type === value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/30 text-muted-foreground"
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {/* Find / Write toggle */}
          {canWrite && (
            <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium shrink-0">
              <button type="button" onClick={() => { setMode("search"); setSelectedItem(null) }}
                className={cn("flex-1 px-3 py-1.5 transition-colors",
                  mode === "search" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
                )}>
                Find existing
              </button>
              <button type="button" onClick={() => setMode("write")}
                className={cn("flex-1 px-3 py-1.5 transition-colors border-l border-border",
                  mode === "write" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
                )}>
                Write new
              </button>
            </div>
          )}

          {/* Content area */}
          {mode === "search" ? (
            <div className="flex flex-col gap-2 min-h-0 flex-1">
              {/* Search input */}
              {(type === "VOCAB" || type === "SENTENCE" || staticOptions.length > 3 || type === "GRAMMAR" || type === "TEXT") && (
                <div className="relative shrink-0">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSelectedItem(null) }}
                    placeholder={`Search ${type === "VOCAB" ? "vocabulary" : type === "GRAMMAR" ? "grammar pages" : type === "TEXT" ? "texts" : "sentences"}…`}
                    className="pl-8 pr-8"
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(""); setSelectedItem(null) }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Results list */}
              <ScrollArea className="flex-1 min-h-0 rounded-md border border-border">
                <div className="p-1">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : listOptions.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      {searchQuery
                        ? `No ${type.toLowerCase()} matching "${searchQuery}"`
                        : `No ${type.toLowerCase()} content yet.`}
                      {canWrite && !searchQuery && (
                        <button onClick={() => setMode("write")} className="mt-1 block w-full text-xs text-primary hover:underline">
                          Write new instead →
                        </button>
                      )}
                      {(type === "GRAMMAR" || type === "TEXT") && (
                        <a
                          href={type === "GRAMMAR" ? `/studio/lang/${slug}/grammar` : `/studio/lang/${slug}/texts`}
                          target="_blank" rel="noopener noreferrer"
                          className="mt-1 flex items-center justify-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open editor
                        </a>
                      )}
                    </div>
                  ) : (
                    listOptions.map((opt) => {
                      const isSelected = selectedItem?.id === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            const raw =
                              type === "VOCAB"    ? vocabResults.find(e => e.id === opt.id)
                              : type === "SENTENCE" ? sentenceResults.find(s => s.id === opt.id)
                              : type === "GRAMMAR"  ? grammarPages.find(p => p.id === opt.id)
                              : texts.find(t => t.id === opt.id)
                            if (raw) setSelectedItem({ id: opt.id, data: raw })
                          }}
                          className={cn(
                            "w-full rounded-md px-3 py-2 text-left text-sm transition-colors flex items-start gap-2",
                            isSelected
                              ? "bg-primary/10 ring-1 ring-primary/30"
                              : "hover:bg-secondary/60"
                          )}
                        >
                          <div className={cn("mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center",
                            isSelected ? "border-primary bg-primary" : "border-border")}>
                            {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className={cn("block truncate font-medium", type === "VOCAB" ? "font-serif" : "")}>{opt.label}</span>
                            {opt.sub && <span className="block truncate text-xs text-muted-foreground">{opt.sub}</span>}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </ScrollArea>

              {/* External link hint for grammar/text */}
              {(type === "GRAMMAR" || type === "TEXT") && listOptions.length > 0 && (
                <p className="text-xs text-muted-foreground shrink-0">
                  Need a new {type === "GRAMMAR" ? "grammar page" : "text"}?{" "}
                  <a href={type === "GRAMMAR" ? `/studio/lang/${slug}/grammar` : `/studio/lang/${slug}/texts`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary hover:underline">
                    Open editor <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              )}
            </div>
          ) : (
            /* Write mode */
            <div className="space-y-3 overflow-y-auto flex-1">
              {type === "SENTENCE" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Sentence <span className="text-muted-foreground text-xs font-normal">(in the conlang)</span></Label>
                    <Input value={sentText} onChange={e => setSentText(e.target.value)} placeholder="e.g. Kara nata vel" autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Translation</Label>
                    <Input value={sentTranslation} onChange={e => setSentTranslation(e.target.value)} placeholder="e.g. The cat runs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gloss <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                    <Input value={sentGloss} onChange={e => setSentGloss(e.target.value)} placeholder="e.g. cat.NOM run.3SG.PRES" />
                  </div>
                  {/* Inline word picker */}
                  <div className="space-y-1.5">
                    <Label>Link to word <span className="text-muted-foreground text-xs font-normal">(required)</span></Label>
                    {sentDictEntry ? (
                      <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 bg-secondary/30">
                        <span className="flex-1 text-sm font-serif font-medium">{sentDictEntry.lemma}</span>
                        <span className="text-xs text-muted-foreground">{sentDictEntry.gloss}</span>
                        <button onClick={() => setSentDictEntry(null)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={wordPickerQuery}
                            onChange={e => { setWordPickerQuery(e.target.value); setWordPickerOpen(true) }}
                            onFocus={() => { setWordPickerOpen(true); if (!wordPickerResults.length) searchDictEntries(languageId, "").then(setWordPickerResults) }}
                            placeholder="Search words…"
                            className="pl-8"
                          />
                        </div>
                        {wordPickerOpen && (
                          <div className="rounded-md border border-border bg-popover max-h-40 overflow-y-auto shadow-md">
                            {wordPickerResults.length === 0 ? (
                              <p className="px-3 py-2 text-sm text-muted-foreground">No words found.</p>
                            ) : wordPickerResults.map(e => (
                              <button
                                key={e.id}
                                type="button"
                                onClick={() => { setSentDictEntry(e); setWordPickerOpen(false); setWordPickerQuery("") }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/60 flex items-center gap-2"
                              >
                                <span className="font-serif font-medium">{e.lemma}</span>
                                <span className="text-muted-foreground text-xs">{e.gloss}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {type === "VOCAB" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Word <span className="text-muted-foreground text-xs font-normal">(base form)</span></Label>
                    <Input value={vocabLemma} onChange={e => setVocabLemma(e.target.value)} placeholder="e.g. kara" autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Meaning</Label>
                    <Input value={vocabGloss} onChange={e => setVocabGloss(e.target.value)} placeholder="e.g. cat" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Part of speech <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                    <Input value={vocabPos} onChange={e => setVocabPos(e.target.value)} placeholder="e.g. noun, verb, adj" />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-2">
          <Button variant="outline" onClick={() => { resetAll(); setOpen(false) }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitDisabled} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "write" ? "Create & Add" : selectedItem ? "Add" : "Select an item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Add lesson button ─────────────────────────────────────────────────────────

function AddLessonButton({ courseId, unitId, onAdded }: { courseId: string; unitId: string | null; onAdded: (l: Lesson) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    try {
      const r = await createLesson(courseId, title.trim(), description.trim() || undefined, unitId)
      if (r.data) {
        onAdded({ ...r.data, items: [], description: r.data.description ?? null, unitId: r.data.unitId ?? null })
        setOpen(false)
        setTitle("")
        setDescription("")
        toast.success("Lesson added")
      } else {
        toast.error(r.error ?? "Failed to add lesson")
      }
    } catch {
      toast.error("Failed to add lesson")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Lesson
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Lesson</DialogTitle></DialogHeader>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Greetings" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !title.trim()} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Add-lesson button bound to a specific unit; resolves courseId via the unit. */
function AddLessonButtonForUnit({ unitId, onAdded }: { unitId: string; onAdded: (l: Lesson) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    try {
      const r = await createLessonInUnit(unitId, title.trim(), description.trim() || undefined)
      if (r.data) {
        onAdded({ ...r.data, items: [], description: r.data.description ?? null, unitId: r.data.unitId ?? null })
        setOpen(false)
        setTitle("")
        setDescription("")
        toast.success("Lesson added")
      } else {
        toast.error("Failed to add lesson")
      }
    } catch {
      toast.error("Failed to add lesson")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Add Lesson to Unit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add Lesson</DialogTitle></DialogHeader>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Greetings" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !title.trim()} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Add unit button ───────────────────────────────────────────────────────────

function AddUnitButton({ courseId, onAdded }: { courseId: string; onAdded: (u: Unit) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    try {
      const r = await createUnit(courseId, title.trim(), description.trim() || undefined)
      if (r.data) {
        onAdded({ id: r.data.id, title: r.data.title, description: r.data.description ?? null, order: r.data.order })
        setOpen(false)
        setTitle("")
        setDescription("")
        toast.success("Unit added")
      } else {
        toast.error("Failed to add unit")
      }
    } catch {
      toast.error("Failed to add unit")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full gap-2">
          <FolderPlus className="h-4 w-4" />
          Add Unit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add Unit</DialogTitle></DialogHeader>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Basics" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !title.trim()} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Unit section ──────────────────────────────────────────────────────────────

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

function UnitSection({
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
