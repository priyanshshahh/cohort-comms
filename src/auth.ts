import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import type { Provider } from 'next-auth/providers'

/**
 * Authentication for the cohort platform.
 *
 * GitHub rather than a hosted auth product, because a production auth
 * deployment has to work on the domain we actually have. Clerk production
 * instances need DNS records on a domain you control, which *.vercel.app
 * cannot provide, so the previous setup was stuck on a development instance
 * with a visible badge, a user cap, and Clerk's own shared OAuth credentials.
 * GitHub OAuth has no DNS requirement, so this is genuinely production auth
 * on the existing URL.
 *
 * It also happens to be the right identity for this cohort: everyone already
 * has a GitHub account, and Forth keys off the same handle, so a member's
 * identity is consistent across both tools.
 *
 * JWT sessions rather than a database adapter. The app already mirrors members
 * into its own `users` table on sign-in and keys everything off that, so an
 * adapter would add a second source of truth for no benefit.
 *
 * Only register providers that have credentials. Auth.js throws a
 * Configuration error if Google/GitHub sit in the array with a missing
 * client_id — which is what `/api/auth/error?error=Configuration` was.
 */
const providers: Provider[] = []

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      // `read:user` and `user:email` so we can resolve a handle and the
      // primary email the roster is matched against.
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      authorization: { params: { scope: 'read:user user:email' } },
    })
  )
}

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  pages: {
    signIn: '/sign-in',
  },
  callbacks: {
    /**
     * Carry the GitHub id and login onto the token. `sub` alone is not enough:
     * we key `users.id` off the provider account id, and the handle drives
     * admin checks and @mentions.
     */
    async jwt({ token, profile, account }) {
      if (profile) {
        // GitHub gives a numeric id and a login; Google gives `sub` and no
        // handle at all, so the handle is derived from the email downstream.
        token.providerId = String(profile.id ?? profile.sub ?? token.sub ?? '')
        token.login = typeof profile.login === 'string' ? profile.login : null
        token.provider = account?.provider ?? null
        // Google's `email_verified` matters: identity here is linked by email,
        // so an unverified address must not inherit someone else's account.
        token.verifiedEmail =
          account?.provider === 'google'
            ? profile.email_verified === true
            : true
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.providerId as string) || (token.sub ?? '')
        session.user.login = (token.login as string | null) ?? null
        session.user.provider = (token.provider as string | null) ?? null
        session.user.verifiedEmail = token.verifiedEmail !== false
      }
      return session
    },
  },
})
