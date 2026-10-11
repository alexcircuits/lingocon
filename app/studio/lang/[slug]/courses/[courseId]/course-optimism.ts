// Optimistic-edit bookkeeping for the course editor.
//
// Every optimistic edit belongs to a scope: one lesson's item order, one group's lesson order, the
// unit order, or one lesson's unit. Edits in a scope can overlap (a second move starts before the
// first one's response arrives) and responses can complete out of order. Per scope the ledger
// keeps the newest optimistic state (what the user sees) and the last server-confirmed state (what
// a failure falls back to). Once a scope has no edit in flight its confirmed state is re-applied,
// so a failure rolls back and an earlier failure never overwrites a later success.
//
// Newer server props rebase the editor: they become the confirmed state of every scope with no
// confirmed edit yet, and in-flight edits are re-applied on top of them.

import type { Course } from "./types"

/** A pure, idempotent update: "set these fields of these rows to these values". */
export type CoursePatch = (course: Course) => Course

/** Builds the patch that restores a scope's fields to their values in the given course. */
export type ScopeCapture = (course: Course) => CoursePatch

interface ScopeState {
  readonly pending: number
  /** Sequence number of the newest edit the server accepted; 0 when none since the scope got busy. */
  readonly confirmedSeq: number
  readonly confirmed: CoursePatch
  readonly latest: CoursePatch
  readonly capture: ScopeCapture
}

export interface OptimisticLedger {
  readonly nextSeq: number
  readonly scopes: ReadonlyMap<string, ScopeState>
}

export const emptyLedger: OptimisticLedger = { nextSeq: 1, scopes: new Map() }

/**
 * Register an optimistic edit of `scope`. `current` is the course on screen before the edit; when
 * the scope is idle its captured state becomes the confirmed fallback.
 */
export function beginOp(
  ledger: OptimisticLedger,
  scope: string,
  edit: { capture: ScopeCapture; after: CoursePatch },
  current: Course,
): { ledger: OptimisticLedger; seq: number } {
  const seq = ledger.nextSeq
  const existing = ledger.scopes.get(scope)
  const next: ScopeState = existing
    ? { ...existing, pending: existing.pending + 1, latest: edit.after }
    : { pending: 1, confirmedSeq: 0, confirmed: edit.capture(current), latest: edit.after, capture: edit.capture }
  return { ledger: { nextSeq: seq + 1, scopes: new Map(ledger.scopes).set(scope, next) }, seq }
}

/**
 * Settle edit `seq` of `scope`. `applied` is the edit's patch when the server accepted it, or null
 * when it failed. Returns the confirmed state to re-apply once the scope has no edit left in flight.
 */
export function settleOp(
  ledger: OptimisticLedger,
  scope: string,
  seq: number,
  applied: CoursePatch | null,
): { ledger: OptimisticLedger; restore: CoursePatch | null } {
  const current = ledger.scopes.get(scope)
  if (!current) return { ledger, restore: null }
  const accepted = applied !== null && seq > current.confirmedSeq
  const settled: ScopeState = {
    ...current,
    pending: current.pending - 1,
    ...(accepted ? { confirmedSeq: seq, confirmed: applied } : {}),
  }
  const scopes = new Map(ledger.scopes)
  if (settled.pending > 0) {
    scopes.set(scope, settled)
    return { ledger: { ...ledger, scopes }, restore: null }
  }
  scopes.delete(scope)
  return { ledger: { ...ledger, scopes }, restore: settled.confirmed }
}

/**
 * Adopt newer server props. Scopes without an accepted edit take the server's values as their
 * fallback; scopes with one keep it (the props may predate it). Edits still in flight stay visible.
 */
export function rebase(ledger: OptimisticLedger, fresh: Course): { ledger: OptimisticLedger; course: Course } {
  const scopes = new Map<string, ScopeState>()
  let course = fresh
  for (const [key, state] of ledger.scopes) {
    scopes.set(key, state.confirmedSeq > 0 ? state : { ...state, confirmed: state.capture(fresh) })
    course = state.latest(course)
  }
  return { ledger: { ...ledger, scopes }, course }
}

// ── Patches ───────────────────────────────────────────────────────────────────

type OrderMap = ReadonlyMap<string, number>

function ordersOf(rows: readonly { id: string; order: number }[], ids?: ReadonlySet<string>): OrderMap {
  return new Map(rows.filter((row) => !ids || ids.has(row.id)).map((row) => [row.id, row.order]))
}

function sequentialOrders(ids: readonly string[]): OrderMap {
  return new Map(ids.map((id, index) => [id, index]))
}

function reorder<T extends { id: string; order: number }>(rows: readonly T[], orders: OrderMap): T[] {
  return rows.map((row) => {
    const order = orders.get(row.id)
    return order === undefined || order === row.order ? row : { ...row, order }
  })
}

function withItemOrders(lessonId: string, orders: OrderMap): CoursePatch {
  return (course) => ({
    ...course,
    lessons: course.lessons.map((lesson) =>
      lesson.id === lessonId ? { ...lesson, items: reorder(lesson.items, orders) } : lesson,
    ),
  })
}

function withLessonOrders(orders: OrderMap): CoursePatch {
  return (course) => ({ ...course, lessons: reorder(course.lessons, orders) })
}

function withUnitOrders(orders: OrderMap): CoursePatch {
  return (course) => ({ ...course, units: reorder(course.units, orders) })
}

function withLessonUnit(lessonId: string, unitId: string | null): CoursePatch {
  return (course) => ({
    ...course,
    lessons: course.lessons.map((lesson) => (lesson.id === lessonId ? { ...lesson, unitId } : lesson)),
  })
}

// ── Edits ─────────────────────────────────────────────────────────────────────

export interface ScopedEdit {
  scope: string
  capture: ScopeCapture
  after: CoursePatch
}

/** Lesson `lessonId`'s items take the order of `orderedIds`. */
export function itemOrderEdit(lessonId: string, orderedIds: readonly string[]): ScopedEdit {
  return {
    scope: `items:${lessonId}`,
    capture: (course) => withItemOrders(lessonId, ordersOf(course.lessons.find((l) => l.id === lessonId)?.items ?? [])),
    after: withItemOrders(lessonId, sequentialOrders(orderedIds)),
  }
}

/** The lessons of one group (a unit, or no unit) take the order of `orderedIds`. */
export function lessonOrderEdit(unitId: string | null, orderedIds: readonly string[]): ScopedEdit {
  const group = new Set(orderedIds)
  return {
    scope: `lessons:${unitId ?? "none"}`,
    capture: (course) => withLessonOrders(ordersOf(course.lessons, group)),
    after: withLessonOrders(sequentialOrders(orderedIds)),
  }
}

/** The course's units take the order of `orderedIds`. */
export function unitOrderEdit(orderedIds: readonly string[]): ScopedEdit {
  return {
    scope: "units",
    capture: (course) => withUnitOrders(ordersOf(course.units)),
    after: withUnitOrders(sequentialOrders(orderedIds)),
  }
}

/** Lesson `lessonId` moves into unit `unitId` (or out of any unit with null). */
export function lessonUnitEdit(lessonId: string, unitId: string | null): ScopedEdit {
  return {
    scope: `unit-of:${lessonId}`,
    capture: (course) => withLessonUnit(lessonId, course.lessons.find((l) => l.id === lessonId)?.unitId ?? null),
    after: withLessonUnit(lessonId, unitId),
  }
}
