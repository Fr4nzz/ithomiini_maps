/**
 * Image proxy utility using wsrv.nl
 * Settings match the Wings Gallery app for shared caching
 */

/**
 * Extract the original URL if already proxied through wsrv.nl
 */
function extractOriginalUrl(url: string): string {
  if (!url) return ''

  // Check if already a wsrv.nl URL
  if (url.includes('wsrv.nl')) {
    try {
      const urlObj = new URL(url)
      const originalUrl = urlObj.searchParams.get('url')
      if (originalUrl) {
        return originalUrl
      }
    } catch {
      // If URL parsing fails, return as-is
    }
  }

  return url
}

interface ProxyOptions {
  width?: number
  quality?: number
  format?: 'webp' | 'jpg' | 'png'
}

/**
 * Get proxied image URL with optimized settings
 */
export function getProxiedUrl(
  originalUrl: string | null | undefined,
  options: ProxyOptions = {}
): string {
  if (!originalUrl) return ''

  // Extract original URL if already proxied
  const cleanUrl = extractOriginalUrl(originalUrl)

  const { width = 2000, quality = 85, format = 'webp' } = options
  const encoded = encodeURIComponent(cleanUrl)
  return `https://wsrv.nl/?url=${encoded}&w=${width}&q=${quality}&output=${format}`
}

/**
 * Get thumbnail URL (smaller size for previews)
 */
export function getThumbnailUrl(originalUrl: string | null | undefined): string {
  if (!originalUrl) return ''

  // Extract original URL if already proxied
  const cleanUrl = extractOriginalUrl(originalUrl)

  // Use smaller width for thumbnails, same quality and format for cache efficiency
  const encoded = encodeURIComponent(cleanUrl)
  return `https://wsrv.nl/?url=${encoded}&w=400&q=85&output=webp`
}
