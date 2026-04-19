/**
 * Auth.js (NextAuth v5) configuration for LingoCon.
 *
 * - Production: GitHub + Google OAuth and email/password credentials; JWT sessions; Prisma adapter.
 * - Local: set `DEV_MODE="true"` to skip OAuth setup — `auth()` returns a synthetic session for the
 *   fixture user in `lib/constants/dev-user.ts` (see `lib/dev-auth.ts` and `docs/DEVELOPMENT.md`).
 *
 * Route surface: `app/api/auth/[...nextauth]/route.ts` re-exports `handlers`.
 */
import NextAuth from "next-auth"
import type { Session, User } from "next-auth"
import type { JWT } from "next-auth/jwt"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { getDevUserId } from "@/lib/dev-auth"
import { PHASE_PRODUCTION_BUILD } from "next/constants"

// `next build` sets NODE_ENV=production while still reading local `.env` (often with DEV_MODE). Skip
// the guard only for that phase; `next start` / hosting must never run with DEV_MODE enabled.
if (
  process.env.NODE_ENV === "production" &&
  process.env.DEV_MODE === "true" &&
  process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD
) {
  throw new Error(
    'DEV_MODE must not be "true" in production — it bypasses real authentication.'
  )
}

const isDevMode = process.env.DEV_MODE === "true"

/**
 * Synthetic session when `DEV_MODE` is enabled.
 * Reuses `getDevUserId()` so we do not run a duplicate find/create path on every request.
 */
async function devAuth() {
  if (!isDevMode) return null

  try {
    const id = await getDevUserId()
    const devUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, image: true },
    })

    if (!devUser) {
      console.error("[devAuth] Dev user row missing after getDevUserId(); check the database.")
      return null
    }

    return {
      user: {
        id: devUser.id,
        email: devUser.email,
        name: devUser.name,
        image: devUser.image,
      },
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }
  } catch (error) {
    console.error("[devAuth] Failed to resolve dev session:", error)
    return null
  }
}

const nextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" as const },
  secret: process.env.AUTH_SECRET,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.password) return null

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) return null

        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt: async ({ token, user }: { token: JWT; user?: User | null }) => {
      if (user?.id) {
        token.id = user.id
      }
      return token
    },
    session: async ({
      session,
      token,
    }: {
      session: Session
      token: JWT
    }) => {
      // `token.id` is only set after sign-in; guard avoids assigning `undefined` to `session.user.id`.
      const userId = token.id
      if (session.user && userId) {
        session.user.id = userId
      }
      return session
    },
  },
}

export const { handlers, signIn, signOut, auth: nextAuth } = NextAuth(nextAuthConfig)

export async function auth() {
  if (isDevMode) {
    return await devAuth()
  }
  return await nextAuth()
}
