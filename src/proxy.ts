import { NextResponse } from 'next/server'
import { auth } from '@/auth'

// Next.js 16 renamed Middleware to Proxy; the behaviour is unchanged.

/**
 * Paths that must work without a session, as regexes anchored at the start.
 * Everything else requires sign-in.
 */
const PUBLIC = [
  /^\/$/,
  /^\/sign-in(?:\/.*)?$/,
  // Reviewers evaluate the product without an account.
  /^\/demo$/,
  // OAuth callback and session endpoints. Gating these would deadlock sign-in.
  /^\/api\/auth(?:\/.*)?$/,
  // Inbound webhooks authenticate with their own shared secret, so they must
  // bypass the session check rather than being redirected to sign-in.
  /^\/api\/webhooks(?:\/.*)?$/,
  // Crawler and agent metadata must stay reachable without a session.
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/llms\.txt$/,
]

export default auth((req) => {
  const { pathname } = req.nextUrl
  if (PUBLIC.some((rx) => rx.test(pathname))) return NextResponse.next()
  if (req.auth) return NextResponse.next()

  // API callers get a status they can act on. Redirecting an XHR to an HTML
  // sign-in page produces a confusing 200 full of markup.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const signIn = new URL('/sign-in', req.nextUrl.origin)
  signIn.searchParams.set('callbackUrl', pathname)
  return NextResponse.redirect(signIn)
})

export const config = {
  matcher: [
    // Skip Next internals and static files unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
