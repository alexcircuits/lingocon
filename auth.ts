import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

const isDevMode = process.env.DEV_MODE === "true"

// Create a mock auth function for development
async function devAuth() {
  if (!isDevMode) return null

  try {
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
    jwt: async ({ token, user }: { token: any; user: any }) => {
      if (user) {
        token.id = user.id
      }
      return token
    },
    session: async ({ session, token }: { session: any; token: any }) => {
      if (session?.user && token?.id) {
        session.user.id = token.id as string
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
