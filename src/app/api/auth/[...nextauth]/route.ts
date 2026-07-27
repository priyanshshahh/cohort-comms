import { handlers } from '@/auth'

/** OAuth callback and session endpoints. Public by design: this is sign-in. */
export const { GET, POST } = handlers
