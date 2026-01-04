import { prisma } from "./prisma"

let devUserId: string | null = null

export async function getDevUserId(): Promise<string> {
  if (devUserId) {
    return devUserId
  }

  // Get or create a dev user
  let devUser = await prisma.user.findFirst({
    where: { email: "dev@localhost" },
  })

  if (!devUser) {
    devUser = await prisma.user.create({
      data: {
        email: "dev@localhost",
        name: "Dev User",
      },
    })
  }

  devUserId = devUser.id
  return devUserId
}

