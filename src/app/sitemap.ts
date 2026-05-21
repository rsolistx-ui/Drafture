import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.getdrafture.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${siteUrl}/`,             lastModified: now, changeFrequency: 'weekly',  priority: 1 },
    { url: `${siteUrl}/pricing`,      lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${siteUrl}/acceptable-use`,lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${siteUrl}/privacy`,      lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${siteUrl}/terms`,        lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${siteUrl}/login`,        lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${siteUrl}/signup`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ]
}
