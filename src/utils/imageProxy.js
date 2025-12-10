/**
 * Image proxy utility using wsrv.nl
 * Settings match the Wings Gallery app for shared caching
 */

/**
 * Get proxied image URL with optimized settings
 * @param {string} originalUrl - The original image URL
 * @param {Object} options - Optional overrides
 * @param {number} options.width - Max width (default: 2000)
 * @param {number} options.quality - Quality 1-100 (default: 85)
 * @param {string} options.format - Output format (default: 'webp')
 * @returns {string} Proxied URL
 */
export function getProxiedUrl(originalUrl, options = {}) {
  if (!originalUrl) return ''

  const { width = 2000, quality = 85, format = 'webp' } = options
  const encoded = encodeURIComponent(originalUrl)
  return `https://wsrv.nl/?url=${encoded}&w=${width}&q=${quality}&output=${format}`
}

/**
 * Get thumbnail URL (smaller size for previews)
 * @param {string} originalUrl - The original image URL
 * @returns {string} Proxied thumbnail URL
 */
export function getThumbnailUrl(originalUrl) {
  if (!originalUrl) return ''

  // Use smaller width for thumbnails, same quality and format for cache efficiency
  const encoded = encodeURIComponent(originalUrl)
  return `https://wsrv.nl/?url=${encoded}&w=400&q=85&output=webp`
}
