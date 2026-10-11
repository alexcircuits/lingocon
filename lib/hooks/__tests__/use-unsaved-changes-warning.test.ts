import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useUnsavedChangesWarning } from "../use-unsaved-changes-warning"

/** Dispatches beforeunload the way a closing tab does; true when the page asked to stay. */
function tabCloseIsBlocked(): boolean {
  const event = new Event("beforeunload", { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

describe("useUnsavedChangesWarning", () => {
  it("asks before the tab closes only while there are unsaved changes", () => {
    const { rerender, unmount } = renderHook(({ dirty }) => useUnsavedChangesWarning(dirty), {
      initialProps: { dirty: false },
    })
    expect(tabCloseIsBlocked()).toBe(false)

    rerender({ dirty: true })
    expect(tabCloseIsBlocked()).toBe(true)

    rerender({ dirty: false }) // saved
    expect(tabCloseIsBlocked()).toBe(false)

    rerender({ dirty: true })
    unmount() // left the editor
    expect(tabCloseIsBlocked()).toBe(false)
  })
})
