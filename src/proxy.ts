import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Next.js 16 renamed Middleware to Proxy; the behaviour is unchanged.
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  // Reviewers evaluate the product without an account.
  '/demo',
  // Inbound webhooks authenticate with their own shared secret, so they must
  // bypass Clerk's session check rather than being redirected to sign-in.
  '/api/webhooks(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next internals and static files unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
