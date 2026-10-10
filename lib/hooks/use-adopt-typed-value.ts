import { useEffect, type RefObject } from "react"

/**
 * Keep what a person typed into a server-rendered field before React hydrated it.
 *
 * Hydration leaves that text in the DOM but not in state, so nothing derived from it
 * (a slug that follows the name, validation) updates, and the field's next render
 * wipes it. On mount, a DOM value that differs from state is handed to `adopt`
 * (typically the field's change logic). Matters on slow devices, where the form is
 * visible well before its JavaScript runs.
 */
export function useAdoptTypedValue(
  ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  stateValue: string,
  adopt: (value: string) => void
): void {
  useEffect(() => {
    const typed = ref.current?.value
    if (typed !== undefined && typed !== stateValue) adopt(typed)
    // Mount only: once hydrated, React keeps the field and the state in step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
