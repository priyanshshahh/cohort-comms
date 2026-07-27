import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'

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
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      // `read:user` and `user:email` so we can resolve a handle and the
      // primary email the roster is matched against.
      authorization: { params: { scope: 'read:user user:email' } },
    }),
  ],
  pages: {
    signIn: '/sign-in',
  },
  callbacks: {
    /**
     * Carry the GitHub id and login onto the token. `sub` alone is not enough:
     * we key `users.id` off the provider account id, and the handle drives
     * admin checks and @mentions.
     */
    async jwt({ token, profile }) {
      if (profile) {
        token.githubId = String(profile.id)
        token.login = typeof profile.login === 'string' ? profile.login : null
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.githubId as string) ?? token.sub ?? ''
        session.user.login = (token.login as string | null) ?? null
      }
      return session
    },
  },
})
