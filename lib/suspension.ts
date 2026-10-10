import { prisma } from "@/lib/prisma"
import { requestCache } from "@/lib/request-cache"

/**
 * Whether the account is suspended. Memoized per request: `auth()` and `getUserId()`
 * both ask, from every layout, page and action of one render.
 */
export const isUserSuspended = requestCache(async function isUserSuspended(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isSuspended: true } })
  return user?.isSuspended ?? false
})
