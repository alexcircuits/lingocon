"use server"

/**
 * Client-callable activity reads. The helpers in `lib/utils/activity.ts` are server-only; these
 * wrappers derive the viewer from the session so a caller can neither read another user's private
 * activity nor pull someone else's follow feed.
 */
import { getUserId } from "@/lib/auth-helpers"
import { getActivitiesForUser, getFeedActivitiesForUser } from "@/lib/utils/activity"

/** Activity shown on a profile page: everything for the owner, PUBLIC-language activity for others. */
export async function getProfileActivities(profileUserId: string, cursor?: string) {
  const viewerId = await getUserId()
  return getActivitiesForUser(profileUserId, viewerId, 20, cursor)
}

/** The signed-in user's follow feed (never another user's). */
export async function getMyFeedActivities(cursor?: string) {
  const viewerId = await getUserId()
  if (!viewerId) return []
  return getFeedActivitiesForUser(viewerId, 50, cursor)
}
