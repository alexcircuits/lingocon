/**
 * Singleton Prisma client for the Next.js dev server and production runtime.
 *
 * Hot reload in development would otherwise create many `PrismaClient` instances; we stash one
 * on `globalThis` between reloads. Always import `prisma` from here — never instantiate ad hoc.
 */
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
