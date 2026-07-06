import type { RatingKey } from "@/lib/fsrs"

/**
 * Map a lesson exercise outcome to an FSRS rating.
 * Incorrect → AGAIN (schedule soon). Correct → GOOD. Correct in a flawless
 * lesson → EASY (stretch the interval a little for demonstrated mastery).
 */
export function resultToRating(correct: boolean, perfect: boolean): RatingKey {
  if (!correct) return "AGAIN"
  return perfect ? "EASY" : "GOOD"
}
