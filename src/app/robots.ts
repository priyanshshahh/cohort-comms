import type { MetadataRoute } from 'next'

const BASE_URL = 'https://cohort-comms-phi.vercel.app'

/**
 * The marketing surface and the demo are indexable; the workspace itself and
 * the API are not — those are private to signed-in cohort members.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/demo'],
        disallow: ['/api/', '/c/', '/dm/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
