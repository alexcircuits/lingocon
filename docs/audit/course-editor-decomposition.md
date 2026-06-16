# Refactor plan: `course-editor.tsx` decomposition

> **Status — phase 1 landed (2026-06-15).** The monolith was split into focused modules
> by **verbatim component moves** (behavior-preserving, `tsc` clean, 152 tests green):
>
> | File | Lines |
> |---|---|
> | `course-editor.tsx` (root) | 1558 → **398** |
> | `add-item-dialog.tsx` | 536 |
> | `lesson-card.tsx` | 212 |
> | `add-buttons.tsx` | 195 |
> | `unit-section.tsx` | 148 |
> | `item-row.tsx` | 61 |
> | `types.ts` | 61 |
> | `move-controls.tsx` | 40 |
>
> Every file is now under the 800-line ceiling. **Deferred (lower priority, higher churn):**
> the `useReducer` store + `useOptimisticAction` helper + context (the duplication fixes below)
> and splitting `add-item-dialog.tsx` further into search/write-forms/results. These change
> handler internals, so they want a manual UI smoke-test — left as the next slice.
>
> ⚠️ No component tests cover this editor; smoke-test the course editor UI before merging.

---


> Reference implementation for breaking up God-files. The same pattern applies to
> `lesson-engine.tsx`, `dictionary-manager.tsx`, `language-family-builder.tsx`, and the
> large `app/actions/*.ts` files. See [platform-audit.md](./platform-audit.md) for the full list.

## Why

`app/studio/lang/[slug]/courses/[courseId]/course-editor.tsx` is **1558 lines** in one
file doing eight jobs. The code itself is clean (correct immutable updates, commented,
formatted) — the problem is **packaging**, not language. This is the proof that a Go
rewrite would fix nothing: there is no TypeScript defect here, only structure.

House rule (rules/common/coding-style.md): 200–400 lines typical, **800 max**.

## What's in the file today

| Section | Lines | Job |
|---|---|---|
| Types (`Course`, `Lesson`, `Unit`, `LessonItem`…) | 38–70 | Data model |
| `arrayMove` | 30–36 | Generic util |
| `CourseEditor` root — state + 8 handlers | 74–433 | State store + layout |
| `LessonCard` | 437–627 | Component |
| `MoveControls` | 631–665 | Component |
| `ItemRow` | 669–720 | Component |
| `AddItemDialog` | 724–1236 | **512-line monster** |
| `AddLessonButton` | 1240–1298 | Form dialog |
| `AddLessonButtonForUnit` | 1301–1359 | ~duplicate of above |
| `AddUnitButton` | 1363–1421 | ~duplicate again |
| `UnitSection` | 1451–1558 | Component (23 props!) |

## The four smells

1. **Repeated optimistic-update dance ×8.** Every handler in the root is: mutate `course`
   immutably → `await action()` → `toast.error` on failure. (`handleSetLessonUnit:191`,
   `handleMoveLesson:200`, `handleMoveUnit:217`, `handleMoveItem:140`, …)
2. **`UnitSection` takes 23 props** (1425–1449), ~15 just forwarded to `LessonCard`.
   Textbook prop-drilling → use context.
3. **Three near-identical form dialogs** (`AddLessonButton`, `AddLessonButtonForUnit`,
   `AddUnitButton`) differ only in the server action + label. ~180 lines that should be ~40.
4. **`AddItemDialog` is itself >800-line-class** — search + pagination + word-picker +
   write-vocab + write-sentence + 20 `useState` calls in one component (734–765).

## Target structure

```
courses/[courseId]/
├─ course-editor.tsx          ~90  — layout + context provider only
├─ types.ts                   ~35  — Course, Lesson, Unit, LessonItem…
├─ use-course-store.ts        ~140 — useReducer: all state + optimistic actions
├─ course-context.tsx         ~25  — kills the prop-drilling
├─ components/
│  ├─ course-header.tsx       ~120 — title/desc/visibility (was inline 233–348)
│  ├─ unit-section.tsx        ~70  — now ~4 props instead of 23
│  ├─ lesson-card.tsx         ~150
│  ├─ item-row.tsx            ~55
│  └─ move-controls.tsx       ~35
├─ add-item/
│  ├─ add-item-dialog.tsx     ~120 — shell + type tabs
│  ├─ use-item-search.ts      ~90  — search + pagination hook
│  ├─ search-results.tsx      ~80
│  └─ write-forms.tsx         ~110 — vocab + sentence write modes
└─ shared/
   ├─ entity-form-dialog.tsx  ~70  — the 3 dialogs collapse into 1
   └─ use-optimistic-action.ts ~25
```

Nothing over ~150 lines.

## Key extractions

### A. Reducer + one optimistic helper (removes the ×8 duplication)

```typescript
// shared/use-optimistic-action.ts
export function useOptimisticAction() {
  return useCallback(async (
    apply: () => void,
    action: () => Promise<{ error?: string }>,
    errorMsg: string,
  ) => {
    apply()
    const r = await action()
    if (r.error) toast.error(errorMsg)
  }, [])
}
```

```typescript
// use-course-store.ts — every mutation becomes a named, testable action
type Action =
  | { type: "reorderItems"; lessonId: string; ids: string[] }
  | { type: "moveLesson"; ids: string[] }
  | { type: "setLessonUnit"; lessonId: string; unitId: string | null }
  | { type: "addItem"; lessonId: string; item: LessonItem }
  | { type: "deleteLesson"; lessonId: string }
  // …one case per mutation
```

The 39-line `handleMoveLesson` shrinks to a 6-line call site.

### B. One `EntityFormDialog` instead of three button components.

### C. `CourseEditorProvider` holds `dispatch`, `languageId`, `slug`, `grammarPages`,
   `texts` → `UnitSection` drops from 23 props to ~4.

## Effort / risk

~Half a day, mechanical, **zero behavior change** — every server action and JSX block is
reused verbatim, just relocated. The payoff beyond readability: the reducer is a **pure
function you can unit-test** — this file currently has 0% coverage because it is untestable
as one blob.
