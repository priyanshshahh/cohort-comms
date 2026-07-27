import 'next-auth'

/**
 * The session carries two fields beyond the defaults: `id` is the GitHub
 * account id, which is what `users.id` is keyed on, and `login` is the GitHub
 * handle that drives admin checks and @mentions.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      login: string | null
      provider: string | null
      verifiedEmail: boolean
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}
