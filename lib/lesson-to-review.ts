import type { RatingKey } from "@/lib/fsrs"

/**
 * Map a lesson exercise outcome to an FSRS rating.
 *
 * - Never answered correctly           → AGAIN (a lapse; schedule very soon).
 * - Correct but needed a retry          → HARD  (recalled with effort; shorter
 *                                                interval than a clean recall,
 *                                                but not a full lapse).
 * - Correct, first try, imperfect lesson → GOOD.
 * - Correct, first try, flawless lesson  → EASY  (stretch for demonstrated mastery).
 *
 * `hadMistake` defaults to false so pre-existing two-argument callers keep the
 * original GOOD/EASY/AGAIN behavior.
 */
export function resultToRating(
  correct: boolean,
  perfect: boolean,
  hadMistake = false,
): RatingKey {
  if (!correct) return "AGAIN"
  if (hadMistake) return "HARD"
  return perfect ? "EASY" : "GOOD"
}
