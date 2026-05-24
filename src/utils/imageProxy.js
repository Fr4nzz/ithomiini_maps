/**
 * Image proxy utility — 3-tier image source system for Google Drive images,
 * with wsrv.nl caching/resizing support for other HTTP image URLs.
 *
 * Tiers (in priority order):
 *   1. wsrv.nl proxy   — cached, WebP compressed, fastest
 *   2. Google CDN (lh3) — direct, highest quality
 *   3. Drive thumbnail  — direct, lower quality fallback
 *
 * Non-Drive images (iNaturalist, IIIF/herbarium, Zenodo, Harvard, etc.) use
 * wsrv.nl in auto/wsrv mode and fall back to their direct URL otherwise.
 */
import { ref } from 'vue'

// ═══════════════════════════════════════════════════════════════════════════
// LOCAL STORAGE HELPERS (no Pinia — safe at module init time)
// ═══════════════════════════════════════════════════════════════════════════

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) return JSON.parse(raw)
  } catch { /* ignore */ }
  return fallback
}

function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// REACTIVE STATE
// ═══════════════════════════════════════════════════════════════════════════

// Migrate old boolean toggle → new mode system
function readInitialMode() {
  const mode = readLocal('proxy-mode', null)
  if (mode) return mode

  // Migration: old key was 'wsrv-proxy-enabled' (boolean)
  const oldVal = readLocal('wsrv-proxy-enabled', null)
  if (oldVal === false) return 'lh3'
  return 'auto'
}

/** Mode: 'auto' | 'wsrv' | 'lh3' | 'thumbnail' | 'off' */
const proxyMode = ref(readInitialMode())

/** Per-tier reachability: 'ok' | 'blocked' | 'unknown' */
const tierStatus = ref({
  wsrv: 'unknown',
  lh3: 'unknown',
  thumbnail: 'unknown',
})

const wsrvFailedUrls = new Set()
const wsrvOversizedHosts = new Set([
  // GBIF media CDN image observed at 8736 x 11648 px; wsrv rejects it before resizing.
  'd2jcv3kl45hlgi.cloudfront.net',
])

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC STATE API
// ═══════════════════════════════════════════════════════════════════════════

/** Expose reactive state for UI binding */
export function getProxyState() {
  return { mode: proxyMode, tierStatus }
}

/** Set the proxy mode and persist */
export function setProxyMode(mode) {
  proxyMode.value = mode
  writeLocal('proxy-mode', mode)
}

// ═══════════════════════════════════════════════════════════════════════════
// STARTUP PROBES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Probe all 3 tiers in parallel to determine reachability.
 * Uses a known Google Drive file ID to load a tiny image from each tier.
 * @param {string} testFileId - A known-public Google Drive file ID
 */
export function checkAllTiers(testFileId) {
  if (!testFileId) return Promise.resolve()

  const probes = Object.keys(tierStatus.value).map(tier => {
    return new Promise(resolve => {
      const img = new Image()
      img.referrerPolicy = 'no-referrer'
      img.onload = () => { tierStatus.value[tier] = 'ok'; resolve() }
      img.onerror = () => { tierStatus.value[tier] = 'blocked'; resolve() }

      let src
      if (tier === 'wsrv') src = buildWsrvUrl(testFileId, 1) + '&t=' + Date.now()
      else if (tier === 'lh3') src = buildLh3Url(testFileId, 1)
      else src = buildThumbnailUrl(testFileId, 1)
      img.src = src
    })
  })
  return Promise.all(probes)
}

export function checkWsrvForUrl(originalUrl) {
  if (!originalUrl) return Promise.resolve(false)
  const probeUrl = getThumbnailUrl(originalUrl)
  if (!probeUrl.includes('wsrv.nl')) {
    if (tierStatus.value.wsrv === 'blocked') tierStatus.value.wsrv = 'unknown'
    return Promise.resolve(false)
  }
  return new Promise(resolve => {
    const img = new Image()
    img.referrerPolicy = 'no-referrer'
    img.onload = () => {
      tierStatus.value.wsrv = 'ok'
      wsrvFailedUrls.delete(unwrapWsrvUrl(probeUrl))
      resolve(true)
    }
    img.onerror = () => {
      wsrvFailedUrls.add(unwrapWsrvUrl(probeUrl))
      if (tierStatus.value.wsrv !== 'ok') tierStatus.value.wsrv = 'blocked'
      resolve(false)
    }
    img.src = `${probeUrl}&probe=${Date.now()}`
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// RUNTIME FAILURE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Called from onImageError when an image fails to load.
 * Identifies which tier the URL belongs to and marks it as blocked.
 * In auto mode, the next reactive render will cascade to the next tier.
 * @param {string} url - The resolved URL that failed to load
 */
export function notifyTierFailed(url) {
  if (!url) return
  if (url.includes('wsrv.nl')) {
    wsrvFailedUrls.add(unwrapWsrvUrl(url))
    if (tierStatus.value.wsrv !== 'ok') tierStatus.value.wsrv = 'blocked'
  }
  else if (url.includes('lh3.google')) tierStatus.value.lh3 = 'blocked'
  else if (url.includes('drive.google')) tierStatus.value.thumbnail = 'blocked'
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract the inner URL from a wsrv.nl proxy URL.
 * Returns the original URL unchanged if it's not a wsrv.nl URL.
 */
function unwrapWsrvUrl(url) {
  if (!url || !url.includes('wsrv.nl')) return url
  try {
    const urlObj = new URL(url)
    return urlObj.searchParams.get('url') || url
  } catch {
    return url
  }
}

/**
 * Extract a Google Drive file ID from various URL patterns.
 * Returns null for non-Drive URLs.
 */
export function extractGoogleDriveFileId(url) {
  if (!url) return null

  // Unwrap wsrv.nl proxy URLs first
  const cleanUrl = unwrapWsrvUrl(url)

  try {
    const urlObj = new URL(cleanUrl)
    const host = urlObj.hostname

    if (host === 'drive.google.com') {
      const id = urlObj.searchParams.get('id')
      if (id) return id
      const match = urlObj.pathname.match(/\/file\/d\/([^/]+)/)
      if (match) return match[1]
    }

    if (host === 'drive.usercontent.google.com') {
      return urlObj.searchParams.get('id') || null
    }
  } catch {
    const match = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    if (match) return match[1]
  }
  return null
}

// ── URL builders ─────────────────────────────────────────────────────────

function buildWsrvUrl(fileId, width) {
  const inner = encodeURIComponent(`https://drive.google.com/uc?id=${fileId}`)
  return `https://wsrv.nl/?url=${inner}&w=${width}&q=85&output=webp`
}

function buildWsrvExternalUrl(originalUrl, width) {
  const cleanUrl = prepareExternalImageUrl(unwrapWsrvUrl(originalUrl), width)
  const inner = encodeURIComponent(cleanUrl)
  return `https://wsrv.nl/?url=${inner}&w=${width}&q=85&output=webp`
}

function shouldSkipWsrvExternalUrl(originalUrl) {
  try {
    return wsrvOversizedHosts.has(new URL(unwrapWsrvUrl(originalUrl)).hostname)
  } catch {
    return false
  }
}

function prepareExternalImageUrl(url, width) {
  return resizeIiifUrl(preferHttpsUrl(url), width)
}

function resizeIiifUrl(url, width) {
  if (!url) return url
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/')
    const iiifIndex = parts.findIndex(part => part === 'iiif')
    if (iiifIndex < 0 || parts[iiifIndex + 1] !== '2') return url

    const defaultIndex = parts.lastIndexOf('default.jpg')
    if (defaultIndex < 0) return url

    const sizeIndex = defaultIndex - 2
    if (sizeIndex <= iiifIndex + 2) return url
    if (!['full', 'max'].includes(parts[sizeIndex])) return url

    const boundedWidth = Math.max(1, Math.round(Number(width) || 1600))
    parts[sizeIndex] = `${boundedWidth},`
    parsed.pathname = parts.join('/')
    return parsed.toString()
  } catch {
    return url
  }
}

function preferHttpsUrl(url) {
  if (!url || !url.startsWith('http://')) return url
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname
    const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
    const isLocal = hostname === 'localhost' || hostname.endsWith('.local')
    if (isIpv4 || isLocal) return url
    parsed.protocol = 'https:'
    return parsed.toString()
  } catch {
    return url
  }
}

function buildLh3Url(fileId, width) {
  return `https://lh3.googleusercontent.com/d/${fileId}=w${width}`
}

function buildThumbnailUrl(fileId, width) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`
}

function uniqueUrls(urls) {
  const seen = new Set()
  return urls.filter(url => {
    if (!url || seen.has(url)) return false
    seen.add(url)
    return true
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve an image URL to the best available source.
 * - Google Drive images → selected tier (or auto-cascade)
 * - Non-Drive images → wsrv.nl in auto/wsrv mode, direct otherwise
 */
function resolveUrl(originalUrl, width) {
  if (!originalUrl) return ''

  const fileId = extractGoogleDriveFileId(originalUrl) // unwraps wsrv.nl internally
  const cleanOriginalUrl = unwrapWsrvUrl(originalUrl)
  const wsrvFailedForUrl = wsrvFailedUrls.has(cleanOriginalUrl)

  const mode = proxyMode.value

  if (mode === 'off') return resizeIiifUrl(cleanOriginalUrl, width)

  if (!fileId) {
    if (mode === 'auto' && shouldSkipWsrvExternalUrl(originalUrl)) {
      return prepareExternalImageUrl(cleanOriginalUrl, width)
    }
    if (mode === 'auto' && !wsrvFailedForUrl) {
      return buildWsrvExternalUrl(originalUrl, width)
    }
    if (mode === 'wsrv') return buildWsrvExternalUrl(originalUrl, width)
    return resizeIiifUrl(unwrapWsrvUrl(originalUrl), width)
  }

  if (mode === 'auto') {
    // Cascade: use best available tier
    if (!wsrvFailedForUrl) return buildWsrvUrl(fileId, width)
    if (tierStatus.value.lh3 !== 'blocked') return buildLh3Url(fileId, width)
    return buildThumbnailUrl(fileId, width)
  }

  // Manual mode: use selected tier directly
  if (mode === 'wsrv') return buildWsrvUrl(fileId, width)
  if (mode === 'lh3') return buildLh3Url(fileId, width)
  if (mode === 'thumbnail') return buildThumbnailUrl(fileId, width)

  return unwrapWsrvUrl(originalUrl)
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API — same signatures as before, all consumers work unchanged
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get optimized image URL (full size for gallery display)
 */
export function getProxiedUrl(originalUrl, options = {}) {
  return resolveUrl(originalUrl, options.width || 2000)
}

/**
 * Return the original/direct URL behind any selected proxy tier.
 * Used as a last-mile fallback when a cache/proxy request stalls.
 */
export function getDirectImageUrl(originalUrl) {
  return unwrapWsrvUrl(originalUrl)
}

/**
 * Return all useful URLs for an image, ordered from preferred to fallback.
 * The first candidate respects the current cache mode; later candidates are
 * direct/provider alternatives used when the preferred candidate stalls.
 */
export function getImageUrlCandidates(originalUrl, options = {}) {
  if (!originalUrl) return []
  const width = options.width || 2000
  const primary = resolveUrl(originalUrl, width)
  const mode = proxyMode.value
  if (mode !== 'auto') return primary ? [primary] : []

  const cleanOriginalUrl = unwrapWsrvUrl(originalUrl)
  const sizedOriginalUrl = resizeIiifUrl(cleanOriginalUrl, width)
  const httpsOriginalUrl = prepareExternalImageUrl(cleanOriginalUrl, width)
  const fileId = extractGoogleDriveFileId(originalUrl)

  if (!fileId) {
    return uniqueUrls([primary, httpsOriginalUrl, sizedOriginalUrl])
  }

  return uniqueUrls([
    primary,
    buildLh3Url(fileId, width),
    buildThumbnailUrl(fileId, width),
    cleanOriginalUrl,
  ])
}

/**
 * Get thumbnail URL (medium size for previews, popups, mimicry cards)
 */
export function getThumbnailUrl(originalUrl) {
  return resolveUrl(originalUrl, 400)
}

/**
 * Get small thumbnail for table rows
 */
export function getTableThumbnailUrl(originalUrl) {
  return resolveUrl(originalUrl, 120)
}
