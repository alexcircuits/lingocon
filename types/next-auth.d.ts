import "next-auth"
import "next-auth/jwt"

/**
 * Extends Auth.js session and JWT types so `session.user.id` and `token.id`
 * are first-class fields across Server Components and Server Actions.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** Mirrors `User.id` for the JWT session strategy. */
    id?: string
  }
}
