"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  GraduationCap, Eye, EyeOff, Loader2, FileText, Layers, Pencil, Check,
} from "lucide-react"
import {
  updateCourse, deleteLesson, setLessonUnit, reorderLessons, reorderUnits, reorderLessonItems,
} from "@/app/actions/learn"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { UnitSection } from "./unit-section"
import { LessonCard } from "./lesson-card"
import { AddLessonButton, AddUnitButton } from "./add-buttons"
import type { Course, Lesson, Unit, LessonItem, GrammarPage, TextItem } from "./types"
import {
  beginOp, emptyLedger, itemOrderEdit, lessonOrderEdit, lessonUnitEdit, rebase, settleOp, unitOrderEdit,
  type OptimisticLedger, type ScopedEdit,
} from "./course-optimism"

/** Move an array element from one index to another (returns a new array). */
function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

interface Props {
  course: Course
  language: { id: string; name: string; slug: string }
  grammarPages: GrammarPage[]
  texts: TextItem[]
  slug: string
}

// ── Course editor (root) ──────────────────────────────────────────────────────

export function CourseEditor({ course: initialCourse, language, grammarPages, texts, slug }: Props) {
  const t = useTranslations("courseEditor")
  const [course, setCourse] = useState(initialCourse)
  const ledgerRef = useRef<OptimisticLedger>(emptyLedger)

  // Course mutations revalidate this route, so their responses (and router.refresh / returning to
  // the page) deliver fresh props. Adopt them, re-applying any optimistic edit still in flight so
  // it is not lost. Open inline editors keep their drafts in their own state.
  const syncedCourseRef = useRef(initialCourse)
  useEffect(() => {
    if (syncedCourseRef.current === initialCourse) return
    syncedCourseRef.current = initialCourse
    const rebased = rebase(ledgerRef.current, initialCourse)
    ledgerRef.current = rebased.ledger
    setCourse(rebased.course)
  }, [initialCourse])

  /** Show `edit` now; keep it if the server accepts, else fall back to the last confirmed state. */
  async function runOptimistic(edit: ScopedEdit, action: () => Promise<{ error?: string }>, failMessage: string) {
    const begun = beginOp(ledgerRef.current, edit.scope, edit, course)
    ledgerRef.current = begun.ledger
    setCourse(edit.after)
    let accepted = false
    try {
      accepted = !(await action()).error
    } catch (error) {
      console.error(failMessage, error)
    }
    if (!accepted) toast.error(failMessage)
    const settled = settleOp(ledgerRef.current, edit.scope, begun.seq, accepted ? edit.after : null)
    ledgerRef.current = settled.ledger
    if (settled.restore) setCourse(settled.restore)
  }

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
        toast.success(next === "PUBLISHED" ? t("coursePublished") : t("movedToDraft"))
      } else {
        toast.error(t("failUpdate"))
      }
    } catch {
      toast.error(t("failUpdate"))
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
        toast.success(t("courseUpdated"))
      } else {
        toast.error(t("failUpdateCourse"))
      }
    } catch {
      toast.error(t("failUpdateCourse"))
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
    await runOptimistic(itemOrderEdit(lessonId, newIds), () => reorderLessonItems(lessonId, newIds), t("failReorderItems"))
  }

  const unitsSorted = [...course.units].sort((a, b) => a.order - b.order)
  const lessonsForUnit = (unitId: string) =>
    course.lessons.filter(l => l.unitId === unitId).sort((a, b) => a.order - b.order)
  const looseLessons = course.lessons.filter(l => !l.unitId).sort((a, b) => a.order - b.order)

  async function handleDeleteLesson(lessonId: string) {
    const r = await deleteLesson(lessonId)
    if (r.data) {
      setCourse(prev => ({ ...prev, lessons: prev.lessons.filter(l => l.id !== lessonId) }))
      toast.success(t("lessonDeleted"))
    }
  }

  // Additions are idempotent: revalidated props may already contain the new row.
  function handleItemAdded(lessonId: string, item: LessonItem) {
    setCourse(prev => ({
      ...prev,
      lessons: prev.lessons.map(l =>
        l.id === lessonId && !l.items.some(i => i.id === item.id) ? { ...l, items: [...l.items, item] } : l,
      ),
    }))
  }

  function handleLessonAdded(lesson: Lesson) {
    setCourse(prev => (prev.lessons.some(l => l.id === lesson.id) ? prev : { ...prev, lessons: [...prev.lessons, lesson] }))
  }

  function handleUnitAdded(unit: Unit) {
    setCourse(prev => (prev.units.some(u => u.id === unit.id) ? prev : { ...prev, units: [...prev.units, unit] }))
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
    await runOptimistic(lessonUnitEdit(lessonId, unitId), () => setLessonUnit(lessonId, unitId), t("failMoveLesson"))
  }

  async function handleMoveLesson(lessonId: string, unitId: string | null, dir: "up" | "down") {
    const group = unitId ? lessonsForUnit(unitId) : looseLessons
    const ids = group.map(l => l.id)
    const idx = ids.indexOf(lessonId)
    const target = dir === "up" ? idx - 1 : idx + 1
    if (idx < 0 || target < 0 || target >= ids.length) return

    const newIds = arrayMove(ids, idx, target)
    await runOptimistic(lessonOrderEdit(unitId, newIds), () => reorderLessons(course.id, newIds), t("failReorderLessons"))
  }

  async function handleMoveUnit(unitId: string, dir: "up" | "down") {
    const ids = unitsSorted.map(u => u.id)
    const idx = ids.indexOf(unitId)
    const target = dir === "up" ? idx - 1 : idx + 1
    if (idx < 0 || target < 0 || target >= ids.length) return

    const newIds = arrayMove(ids, idx, target)
    await runOptimistic(unitOrderEdit(newIds), () => reorderUnits(course.id, newIds), t("failReorderUnits"))
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
                placeholder={t("courseTitlePh")}
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
                placeholder={t("descriptionOptionalPh")}
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
            onLessonAdded={handleLessonAdded}
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
                {t("lessonsNotInUnit")}
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
              onAdded={handleLessonAdded}
            />
          </div>
        )}
      </div>

      <div className="mt-6">
        <AddUnitButton
          courseId={course.id}
          onAdded={handleUnitAdded}
        />
      </div>
    </div>
  )
}
