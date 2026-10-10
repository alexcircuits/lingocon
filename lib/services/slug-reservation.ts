import { prisma } from "@/lib/prisma"

/**
 * When a project is renamed its previous slug stays reserved for a while and
 * should lead to the project's current slug. Returns that current slug, or null
 * when the slug is not (or no longer) reserved.
 */
export async function findReservedSlugTarget(slug: string): Promise<string | null> {
  if (!slug) return null
  const reservation = await prisma.slugReservation.findUnique({
    where: { slug },
    select: { reservedUntil: true, language: { select: { slug: true } } },
  })
  if (!reservation || reservation.reservedUntil <= new Date()) return null
  const target = reservation.language?.slug
  return target && target !== slug ? target : null
}
