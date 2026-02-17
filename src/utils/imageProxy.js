/**
 * Image proxy utility — conditionally routes Google Drive images through
 * wsrv.nl for caching/compression, with lh3.googleusercontent.com as fallback.
 * Non-Drive images (iNaturalist, Zenodo, Harvard, etc.) always load directly.
 */
import { ref } from 'vue'

// ═══════════════════════════════════════════════════════════════════════════
// REACTIVE STATE
// ═══════════════════════════════════════════════════════════════════════════

// Read directly from localStorage at module init to avoid calling Pinia
// before app.use(pinia) has run. storageHelpers.js uses usePersistenceStore()
// which would crash at top-level import time.
function readInitialValue() {
  try {
    const raw = localStorage.getItem('wsrv-proxy-enabled')
    if (raw !== null) return JSON.parse(raw)
  } catch { /* ignore */ }
  return true // default: enabled
}

const wsrvEnabled = ref(readInitialValue())
const wsrvBanned = ref(false) // runtime-only, reset on each page load

/** Whether wsrv.nl is currently usable (enabled AND not banned) */
export function isWsrvEnabled() { return wsrvEnabled.value && !wsrvBanned.value }

export function setWsrvEnabled(enabled) {
  wsrvEnabled.value = enabled
  try { localStorage.setItem('wsrv-proxy-enabled', JSON.stringify(enabled)) } catch { /* ignore */ }
}

export function toggleWsrvEnabled() { setWsrvEnabled(!wsrvEnabled.value) }

/** Expose reactive refs for UI binding */
export function getWsrvState() { return { enabled: wsrvEnabled, banned: wsrvBanned } }

/**
 * Mark wsrv.nl as banned (called when image loads fail on wsrv.nl URLs).
 * This is runtime-only — a page reload re-checks availability.
 */
export function notifyWsrvBanned() {
  if (wsrvBanned.value) return
  wsrvBanned.value = true
}

/**
 * Probe wsrv.nl at startup to detect IP bans before the user sees broken images.
 * Uses a tiny test image; if it fails to load, marks wsrv.nl as banned.
 */
export function checkWsrvAvailability() {
  if (!wsrvEnabled.value || wsrvBanned.value) return Promise.resolve()
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => {
      wsrvBanned.value = true
      resolve()
    }
    // Tiny 1x1 PNG via wsrv.nl — cache-bust with timestamp
    img.src = 'https://wsrv.nl/?url=https://via.placeholder.com/1x1.png&w=1&output=webp&t=' + Date.now()
  })
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
 * Extract a Google Drive file ID from various URL patterns:
 * - drive.google.com/uc?id={ID}
 * - drive.google.com/file/d/{ID}/...
 * - drive.usercontent.google.com/download?id={ID}
 * Returns null for non-Drive URLs.
 */
function extractGoogleDriveFileId(url) {
  if (!url) return null
  try {
    const urlObj = new URL(url)
    const host = urlObj.hostname

    // drive.google.com/uc?id=... or drive.google.com/open?id=...
    if (host === 'drive.google.com') {
      const id = urlObj.searchParams.get('id')
      if (id) return id
      // drive.google.com/file/d/{ID}/...
      const match = urlObj.pathname.match(/\/file\/d\/([^/]+)/)
      if (match) return match[1]
    }

    // drive.usercontent.google.com/download?id=...
    if (host === 'drive.usercontent.google.com') {
      return urlObj.searchParams.get('id') || null
    }
  } catch {
    // Fallback: regex for malformed URLs
    const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    if (match) return match[1]
  }
  return null
}

/** Build a Google lh3 direct URL with resize parameter */
function buildDriveDirectUrl(fileId, width) {
  return `https://lh3.googleusercontent.com/d/${fileId}=w${width}`
}

/** Build a wsrv.nl proxy URL */
function buildWsrvUrl(innerUrl, width) {
  const encoded = encodeURIComponent(innerUrl)
  return `https://wsrv.nl/?url=${encoded}&w=${width}&q=85&output=webp`
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API — same signatures as before, all consumers work unchanged
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve an image URL to the best available source.
 * - Google Drive images → wsrv.nl (if enabled) or lh3 fallback
 * - Non-Drive images → direct URL (no proxy needed)
 */
function resolveUrl(originalUrl, width) {
  if (!originalUrl) return ''

  // Strip any existing wsrv.nl wrapper to get the real source URL
  const cleanUrl = unwrapWsrvUrl(originalUrl)
  const fileId = extractGoogleDriveFileId(cleanUrl)

  if (fileId) {
    // Google Drive image
    if (isWsrvEnabled()) {
      return buildWsrvUrl(`https://drive.google.com/uc?id=${fileId}`, width)
    }
    // Fallback: Google's own image CDN with built-in resize
    return buildDriveDirectUrl(fileId, width)
  }

  // Non-Drive image (iNaturalist, Zenodo, Harvard, etc.) — always direct
  return cleanUrl
}

/**
 * Get optimized image URL (full size for gallery display)
 * @param {string} originalUrl - The original image URL (may be wsrv.nl-wrapped)
 * @param {Object} options - Optional overrides
 * @param {number} options.width - Max width (default: 2000)
 * @returns {string} Resolved URL
 */
export function getProxiedUrl(originalUrl, options = {}) {
  return resolveUrl(originalUrl, options.width || 2000)
}

/**
 * Get thumbnail URL (medium size for previews, popups, mimicry cards)
 * @param {string} originalUrl - The original image URL
 * @returns {string} Resolved thumbnail URL
 */
export function getThumbnailUrl(originalUrl) {
  return resolveUrl(originalUrl, 400)
}

/**
 * Get small thumbnail for table rows
 * @param {string} originalUrl - The original image URL
 * @returns {string} Resolved small thumbnail URL
 */
export function getTableThumbnailUrl(originalUrl) {
  return resolveUrl(originalUrl, 120)
}
