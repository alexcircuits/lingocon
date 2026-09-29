import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Internal route called by Edge middleware to check slug reservations
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Called by middleware with x-internal-auth. When INTERNAL_API_KEY is configured, enforce it (the
  // previous check was an empty if). Without a key the data is harmless — the same old→new slug
  // mapping is public through the redirect itself — so local setups keep working.
  const expectedKey = process.env.INTERNAL_API_KEY
  if (expectedKey && request.headers.get("x-internal-auth") !== expectedKey) {
    return NextResponse.json({ found: false }, { status: 403 })
  }

  try {
    const { slug } = await params
    if (!slug) return NextResponse.json({ found: false })

    const reservation = await prisma.slugReservation.findUnique({
      where: { slug },
      include: {
        language: {
          select: { slug: true }
        }
      }
    })

    if (reservation && reservation.reservedUntil > new Date() && reservation.language?.slug) {
      return NextResponse.json({
        found: true,
        newSlug: reservation.language.slug
      })
    }

    return NextResponse.json({ found: false })
  } catch (error) {
    console.error("[SlugReservation API]", error)
    return NextResponse.json({ found: false }, { status: 500 })
  }
}
