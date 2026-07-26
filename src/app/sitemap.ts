import type { MetadataRoute } from 'next'

const BASE_URL = 'https://cohort-comms-phi.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/demo`, changeFrequency: 'weekly', priority: 0.8 },
  ]
}
