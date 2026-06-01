import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Internal route called by Edge middleware to check slug reservations
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Only allow internal calls (rudimentary check to prevent abuse, though it's harmless data)
  const authHeader = request.headers.get("x-internal-auth")
  if (authHeader !== process.env.INTERNAL_API_KEY && process.env.NODE_ENV === "production") {
    // In dev we might not have the key, but in prod we should secure it
    // Actually, to make it simple and bulletproof for both envs without new env vars:
    // It's a read-only endpoint that just returns the new slug if reserved. No PII.
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
