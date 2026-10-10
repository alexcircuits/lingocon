"use client"

import { useState } from "react"

/**
 * True from the first render in which `open` is true, and from then on.
 *
 * Gate a code-split dialog with it (`{openedOnce && <LazyDialog open={open} />}`): its chunk is
 * requested the first time the user opens it, never for a page view that does not, and once
 * mounted the dialog stays mounted so its close animation still plays.
 */
export function useOpenedOnce(open: boolean): boolean {
  const [opened, setOpened] = useState(open)
  // Updating state while rendering is React's pattern for state derived from earlier renders;
  // it re-renders immediately, before anything is committed.
  if (open && !opened) setOpened(true)
  return opened || open
}
