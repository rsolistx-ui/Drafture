import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.getdrafture.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing', '/honor-code', '/acceptable-use', '/privacy', '/terms', '/login', '/signup'],
        disallow: ['/dashboard', '/admin', '/api'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
