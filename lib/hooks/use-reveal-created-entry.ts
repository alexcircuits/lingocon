"use client"

import { useCallback, useEffect } from "react"

/**
 * After creating an entry, make sure the user can see it.
 *
 * The create action revalidates the page, so the server re-renders the current
 * view. If that view is a different page, a filter or an alphabetical sort, the
 * new entry is saved but not on screen — which looks exactly like "it didn't
 * save". When the re-rendered entries do not contain the new id, `reveal()` is
 * called once (e.g. to switch to the newest-first view).
 *
 * Two runtime details shape this:
 * - The action's re-render can commit before or after the awaited action
 *   resumes, so `begin()` snapshots the entries and `settle()` decides now if
 *   they already changed, or on the next change otherwise.
 * - In Next 14 a revalidating Server Action's re-render remounts the page's
 *   client components, so per-instance refs would lose the pending entry. State
 *   therefore lives in a small browser-only module store keyed by `scope` (the
 *   project), written only from effects and callbacks (never during render, so
 *   the server never retains it).
 */
type Entries = readonly { id: string }[]

interface ScopeState {
  latest: Entries | null
  pending: { id: string; since: Entries; at: number } | null
  reveal: (() => void) | null
}

/** A save's re-render arrives within a second or two; anything older is abandoned. */
const PENDING_TTL_MS = 10_000

const scopes = new Map<string, ScopeState>()

function scopeState(scope: string): ScopeState {
  let state = scopes.get(scope)
  if (!state) {
    state = { latest: null, pending: null, reveal: null }
    scopes.set(scope, state)
  }
  return state
}

function decide(state: ScopeState, entries: Entries, createdId: string): void {
  state.pending = null
  if (!entries.some((entry) => entry.id === createdId)) state.reveal?.()
}

export function useRevealCreatedEntry<T extends { id: string }>(
  scope: string,
  entries: readonly T[],
  reveal: () => void
): { begin: () => readonly T[]; settle: (since: readonly T[], createdId: string) => void } {
  // The mounted instance always provides the current navigation callback.
  useEffect(() => {
    scopeState(scope).reveal = reveal
  }, [scope, reveal])

  useEffect(() => {
    const state = scopeState(scope)
    state.latest = entries
    const waiting = state.pending
    if (!waiting || entries === waiting.since) return
    if (Date.now() - waiting.at > PENDING_TTL_MS) {
      state.pending = null
      return
    }
    decide(state, entries, waiting.id)
  }, [scope, entries])

  const begin = useCallback(
    () => (scopes.get(scope)?.latest ?? entries) as readonly T[],
    [scope, entries]
  )

  const settle = useCallback((since: readonly T[], createdId: string) => {
    const state = scopeState(scope)
    const latest = state.latest
    if (latest && latest !== since) {
      decide(state, latest, createdId)
      return
    }
    state.pending = { id: createdId, since, at: Date.now() }
  }, [scope])

  return { begin, settle }
}
