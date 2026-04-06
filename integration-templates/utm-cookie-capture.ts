/**
 * UTM Cookie Capture Utility
 *
 * Drop this into both gameview.ai and melissaforeducators.ai marketing sites.
 * On page load, reads UTM params from the URL and writes them to a 30-day cookie
 * named `campaign_attribution`. The cookie persists across page navigations even
 * when the URL no longer has UTM params.
 *
 * Usage:
 *   // In your root layout or _app.tsx:
 *   import { captureUTMParams, getAttribution } from './utm-cookie-capture'
 *
 *   // Call on every page load (e.g., in a useEffect or layout component):
 *   captureUTMParams()
 *
 *   // Later, when creating a Stripe session or handling signup:
 *   const attribution = getAttribution()
 *   // attribution = { utm_source: "facebook", utm_medium: "social", ... } or null
 */

const COOKIE_NAME = 'campaign_attribution'
const COOKIE_MAX_AGE_DAYS = 30

export interface CampaignAttribution {
  utm_source: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  captured_at: string
}

/**
 * Read UTM params from the current URL. If any are present, write them
 * to a 30-day cookie. If the cookie already exists and the URL has no
 * UTM params, the existing cookie is preserved.
 */
export function captureUTMParams(): void {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  const utmSource = params.get('utm_source')

  // Only write cookie if at least utm_source is present in the URL
  if (!utmSource) return

  const attribution: CampaignAttribution = {
    utm_source: utmSource,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    utm_content: params.get('utm_content') || undefined,
    captured_at: new Date().toISOString(),
  }

  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60
  const value = encodeURIComponent(JSON.stringify(attribution))
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`
}

/**
 * Read the campaign attribution cookie. Returns null if no attribution exists.
 */
export function getAttribution(): CampaignAttribution | null {
  if (typeof document === 'undefined') return null

  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=')
    if (name === COOKIE_NAME) {
      try {
        return JSON.parse(decodeURIComponent(valueParts.join('=')))
      } catch {
        return null
      }
    }
  }
  return null
}

/**
 * Read the campaign attribution cookie from a server-side request cookie header.
 * Use this in API routes / server actions.
 */
export function getAttributionFromCookieHeader(
  cookieHeader: string | null
): CampaignAttribution | null {
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';')
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=')
    if (name === COOKIE_NAME) {
      try {
        return JSON.parse(decodeURIComponent(valueParts.join('=')))
      } catch {
        return null
      }
    }
  }
  return null
}
