/**
 * UTM Parameter Generation Utility
 *
 * Auto-generates UTM tracking parameters for all outbound links
 * in social media posts. Used for conversion tracking.
 *
 * Pattern: ?utm_source={platform}&utm_medium=social&utm_campaign={campaign-slug}&utm_content={content-id}
 */

export interface UTMParams {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_content: string
}

/**
 * Generate UTM parameters for a post.
 */
export function generateUTMParams(options: {
  platform: string
  campaignSlug: string
  contentId: string
}): UTMParams {
  return {
    utm_source: options.platform,
    utm_medium: 'social',
    utm_campaign: options.campaignSlug,
    utm_content: options.contentId,
  }
}

/**
 * Build UTM query string from params.
 * Returns the full query string including the leading '?'.
 */
export function buildUTMQueryString(params: UTMParams): string {
  const searchParams = new URLSearchParams({
    utm_source: params.utm_source,
    utm_medium: params.utm_medium,
    utm_campaign: params.utm_campaign,
    utm_content: params.utm_content,
  })
  return `?${searchParams.toString()}`
}

/**
 * Append UTM parameters to a URL.
 * Handles URLs that already have query parameters.
 */
export function appendUTMToUrl(url: string, params: UTMParams): string {
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('utm_source', params.utm_source)
    parsed.searchParams.set('utm_medium', params.utm_medium)
    parsed.searchParams.set('utm_campaign', params.utm_campaign)
    parsed.searchParams.set('utm_content', params.utm_content)
    return parsed.toString()
  } catch {
    // If URL parsing fails, append as query string
    const separator = url.includes('?') ? '&' : '?'
    const qs = new URLSearchParams({
      utm_source: params.utm_source,
      utm_medium: params.utm_medium,
      utm_campaign: params.utm_campaign,
      utm_content: params.utm_content,
    }).toString()
    return `${url}${separator}${qs}`
  }
}

/**
 * Generate a slug from a campaign name for use in UTM params.
 * Converts to lowercase, replaces spaces with hyphens, removes special chars.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
