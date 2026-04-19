/**
 * Resolves (and memoizes) the database user used when `DEV_MODE="true"`.
 *
 * The fixture email is defined in `lib/constants/dev-user.ts`. First call creates the row if
 * missing; subsequent calls reuse the cached id for the lifetime of the Node process.
 */
import { prisma } from "./prisma"
import { DEV_MODE_USER_DISPLAY_NAME, DEV_MODE_USER_EMAIL } from "@/lib/constants/dev-user"

let devUserId: string | null = null

export async function getDevUserId(): Promise<string> {
  if (devUserId) {
    return devUserId
  }

  // Get or create a dev user
  let devUser = await prisma.user.findFirst({
    where: { email: DEV_MODE_USER_EMAIL },
  })

  if (!devUser) {
    devUser = await prisma.user.create({
      data: {
        email: DEV_MODE_USER_EMAIL,
        name: DEV_MODE_USER_DISPLAY_NAME,
      },
    })
  }

  devUserId = devUser.id
  return devUserId
}

