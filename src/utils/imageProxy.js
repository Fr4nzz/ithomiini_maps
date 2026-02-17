/**
 * Image proxy utility — 3-tier image source system for Google Drive images.
 *
 * Tiers (in priority order):
 *   1. wsrv.nl proxy   — cached, WebP compressed, fastest
 *   2. Google CDN (lh3) — direct, highest quality
 *   3. Drive thumbnail  — direct, lower quality fallback
 *
 * Non-Drive images (iNaturalist, Zenodo, Harvard, etc.) always load directly.
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

/** Mode: 'auto' | 'wsrv' | 'lh3' | 'thumbnail' */
const proxyMode = ref(readInitialMode())

/** Per-tier reachability: 'ok' | 'blocked' | 'unknown' */
const tierStatus = ref({
  wsrv: 'unknown',
  lh3: 'unknown',
  thumbnail: 'unknown',
})

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
  if (url.includes('wsrv.nl')) tierStatus.value.wsrv = 'blocked'
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

function buildLh3Url(fileId, width) {
  return `https://lh3.googleusercontent.com/d/${fileId}=w${width}`
}

function buildThumbnailUrl(fileId, width) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve an image URL to the best available source.
 * - Google Drive images → selected tier (or auto-cascade)
 * - Non-Drive images → direct URL (no proxy)
 */
function resolveUrl(originalUrl, width) {
  if (!originalUrl) return ''

  const cleanUrl = unwrapWsrvUrl(originalUrl)
  const fileId = extractGoogleDriveFileId(cleanUrl)

  if (!fileId) return cleanUrl // non-Drive → always direct

  const mode = proxyMode.value

  if (mode === 'auto') {
    // Cascade: use best available tier
    if (tierStatus.value.wsrv !== 'blocked') return buildWsrvUrl(fileId, width)
    if (tierStatus.value.lh3 !== 'blocked') return buildLh3Url(fileId, width)
    return buildThumbnailUrl(fileId, width)
  }

  // Manual mode: use selected tier directly
  if (mode === 'wsrv') return buildWsrvUrl(fileId, width)
  if (mode === 'lh3') return buildLh3Url(fileId, width)
  if (mode === 'thumbnail') return buildThumbnailUrl(fileId, width)

  return cleanUrl
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
