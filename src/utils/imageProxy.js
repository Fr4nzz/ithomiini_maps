/**
 * Image proxy utility using wsrv.nl
 * Settings match the Wings Gallery app for shared caching
 */

/**
 * Extract the original URL if already proxied through wsrv.nl
 * @param {string} url - The URL to check
 * @returns {string} The original URL (extracted if proxied, or as-is)
 */
function extractOriginalUrl(url) {
  if (!url) return ''

  // Check if already a wsrv.nl URL
  if (url.includes('wsrv.nl')) {
    try {
      const urlObj = new URL(url)
      const originalUrl = urlObj.searchParams.get('url')
      if (originalUrl) {
        return originalUrl
      }
    } catch (e) {
      // If URL parsing fails, return as-is
    }
  }

  return url
}

/**
 * Get proxied image URL with optimized settings
 * @param {string} originalUrl - The original image URL (may already be proxied)
 * @param {Object} options - Optional overrides
 * @param {number} options.width - Max width (default: 2000)
 * @param {number} options.quality - Quality 1-100 (default: 85)
 * @param {string} options.format - Output format (default: 'webp')
 * @returns {string} Proxied URL
 */
export function getProxiedUrl(originalUrl, options = {}) {
  if (!originalUrl) return ''

  // Extract original URL if already proxied
  const cleanUrl = extractOriginalUrl(originalUrl)

  const { width = 2000, quality = 85, format = 'webp' } = options
  const encoded = encodeURIComponent(cleanUrl)
  return `https://wsrv.nl/?url=${encoded}&w=${width}&q=${quality}&output=${format}`
}

/**
 * Get thumbnail URL (smaller size for previews)
 * @param {string} originalUrl - The original image URL (may already be proxied)
 * @returns {string} Proxied thumbnail URL
 */
export function getThumbnailUrl(originalUrl) {
  if (!originalUrl) return ''

  // Extract original URL if already proxied
  const cleanUrl = extractOriginalUrl(originalUrl)

  // Use smaller width for thumbnails, same quality and format for cache efficiency
  const encoded = encodeURIComponent(cleanUrl)
  return `https://wsrv.nl/?url=${encoded}&w=400&q=85&output=webp`
}

/**
 * Get small square thumbnail for table rows (60x60 cropped)
 * @param {string} originalUrl - The original image URL (may already be proxied)
 * @returns {string} Proxied small thumbnail URL
 */
export function getTableThumbnailUrl(originalUrl) {
  if (!originalUrl) return ''

  const cleanUrl = extractOriginalUrl(originalUrl)
  const encoded = encodeURIComponent(cleanUrl)
  return `https://wsrv.nl/?url=${encoded}&w=60&h=60&fit=cover&output=webp`
}
