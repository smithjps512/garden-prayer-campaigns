import crypto from 'crypto'

// =============================================================================
// Configuration
// =============================================================================

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'
const META_APP_ID = process.env.META_APP_ID!
const META_APP_SECRET = process.env.META_APP_SECRET!
const META_REDIRECT_URI =
  process.env.META_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/callback`

// Encryption key derived from AUTH_SECRET (used for token-at-rest encryption)
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(process.env.AUTH_SECRET || 'development-secret-key-must-be-at-least-32-chars')
  .digest()

const OAUTH_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_user_content',
  'instagram_basic',
  'instagram_content_publish',
].join(',')

// =============================================================================
// Types
// =============================================================================

export interface MetaApiError {
  message: string
  type: string
  code: number
  error_subcode?: number
  fbtrace_id?: string
}

export class MetaError extends Error {
  public readonly code: number
  public readonly type: string
  public readonly subcode?: number
  public readonly fbtraceId?: string

  constructor(apiError: MetaApiError) {
    super(apiError.message)
    this.name = 'MetaError'
    this.code = apiError.code
    this.type = apiError.type
    this.subcode = apiError.error_subcode
    this.fbtraceId = apiError.fbtrace_id
  }

  /** True if this is a rate-limit error (HTTP 429 / code 32 or 4) */
  get isRateLimited(): boolean {
    return this.code === 32 || this.code === 4
  }

  /** True if the token has expired or been invalidated */
  get isTokenExpired(): boolean {
    return this.code === 190
  }

  /** True if this is a permissions error */
  get isPermissionError(): boolean {
    return this.code === 10 || this.code === 200 || this.code === 190
  }
}

export interface MetaPage {
  id: string
  name: string
  access_token: string
  category?: string
  tasks?: string[]
}

export interface MetaIgAccount {
  id: string
  name?: string
  username?: string
  profile_picture_url?: string
}

export interface MetaTokenInfo {
  access_token: string
  token_type: string
  expires_in?: number
}

export interface MetaPostResult {
  id: string // The platform post ID
}

export interface MetaPostInsights {
  impressions: number
  reach: number
  clicks: number
  reactions: number
  comments: number
  shares: number
}

// =============================================================================
// Token Encryption / Decryption
// =============================================================================

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Encrypt a page access token for storage in the database.
 * Uses AES-256-GCM with a random IV. Output format: iv:authTag:ciphertext (hex).
 */
export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt a stored page access token.
 */
export function decryptToken(encrypted: string): string {
  const [ivHex, authTagHex, ciphertext] = encrypted.split(':')
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error('Invalid encrypted token format')
  }
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// =============================================================================
// OAuth Helpers
// =============================================================================

/**
 * Build the Meta OAuth authorization URL that the user will be redirected to.
 */
export function getOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    scope: OAUTH_SCOPES,
    response_type: 'code',
    state,
    // Force re-prompt for all permissions on reconnect
    auth_type: 'rerequest',
  })
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
}

/**
 * Exchange an OAuth authorization code for a short-lived user access token.
 */
export async function exchangeCodeForToken(code: string): Promise<MetaTokenInfo> {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    redirect_uri: META_REDIRECT_URI,
    code,
  })

  const res = await metaFetch(`/oauth/access_token?${params.toString()}`)
  return res as MetaTokenInfo
}

/**
 * Exchange a short-lived user token for a long-lived user token (~60 days).
 */
export async function getLongLivedToken(shortLivedToken: string): Promise<MetaTokenInfo> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  })

  const res = await metaFetch(`/oauth/access_token?${params.toString()}`)
  return res as MetaTokenInfo
}

/**
 * Get a long-lived page access token from a long-lived user token.
 * Page tokens obtained this way never expire (until user de-authorizes the app).
 */
export async function getPageAccessToken(
  userToken: string,
  pageId: string
): Promise<string> {
  const pages = await getPages(userToken)
  const page = pages.find((p) => p.id === pageId)
  if (!page) {
    throw new Error(`Page ${pageId} not found or not accessible with this token`)
  }
  return page.access_token
}

// =============================================================================
// Pages & Instagram Account Discovery
// =============================================================================

/**
 * List Facebook Pages the user has access to manage.
 */
export async function getPages(userToken: string): Promise<MetaPage[]> {
  // First, verify the token is valid and check granted permissions
  try {
    const debugRes = await metaFetch(
      `/debug_token?input_token=${userToken}&access_token=${META_APP_ID}|${META_APP_SECRET}`
    )
    const debugData = debugRes as {
      data?: { scopes?: string[]; type?: string; app_id?: string; is_valid?: boolean }
    }
    console.log('[Meta] Token debug info:', JSON.stringify({
      is_valid: debugData.data?.is_valid,
      type: debugData.data?.type,
      scopes: debugData.data?.scopes,
      app_id: debugData.data?.app_id,
    }))
  } catch (debugErr) {
    console.warn('[Meta] Token debug check failed (non-fatal):', debugErr)
  }

  const res = await metaFetch(
    `/me/accounts?fields=id,name,access_token,category,tasks&access_token=${userToken}`
  )

  const pagesResponse = res as { data?: MetaPage[]; paging?: unknown }
  console.log('[Meta] /me/accounts response:', JSON.stringify({
    pageCount: pagesResponse.data?.length ?? 0,
    pageNames: pagesResponse.data?.map((p) => p.name) ?? [],
    hasPaging: !!pagesResponse.paging,
  }))

  return pagesResponse.data || []
}

/**
 * Get the Instagram Business Account connected to a Facebook Page.
 * Returns null if no IG account is connected.
 */
export async function getIgAccount(
  pageId: string,
  pageToken: string
): Promise<MetaIgAccount | null> {
  try {
    const res = await metaFetch(
      `/${pageId}?fields=instagram_business_account{id,name,username,profile_picture_url}&access_token=${pageToken}`
    )
    const data = res as { instagram_business_account?: MetaIgAccount }
    return data.instagram_business_account || null
  } catch (err) {
    if (err instanceof MetaError && err.isPermissionError) {
      return null
    }
    throw err
  }
}

/**
 * Refresh a page token. Long-lived page tokens don't truly expire,
 * but this refreshes the associated user token to extend the 60-day window.
 * Returns a new long-lived user token.
 */
export async function refreshUserToken(longLivedUserToken: string): Promise<MetaTokenInfo> {
  // Meta's refresh endpoint is the same as the exchange endpoint
  return getLongLivedToken(longLivedUserToken)
}

// =============================================================================
// Posting — Facebook
// =============================================================================

export interface FacebookPostInput {
  message: string
  link?: string
  imageUrl?: string
}

/**
 * Post to a Facebook Page.
 * - Text-only or text + link: single API call to /feed
 * - With image: upload photo via /photos endpoint
 */
export async function postToFacebook(
  pageId: string,
  pageToken: string,
  input: FacebookPostInput
): Promise<MetaPostResult> {
  if (input.imageUrl) {
    // Photo post — uses /photos endpoint
    const body: Record<string, string> = {
      url: input.imageUrl,
      caption: input.message,
      access_token: pageToken,
    }
    if (input.link) {
      body.caption = `${input.message}\n\n${input.link}`
    }
    const res = await metaFetch(`/${pageId}/photos`, {
      method: 'POST',
      body,
    })
    return res as MetaPostResult
  }

  // Text/link post — uses /feed endpoint
  const body: Record<string, string> = {
    message: input.message,
    access_token: pageToken,
  }
  if (input.link) {
    body.link = input.link
  }
  const res = await metaFetch(`/${pageId}/feed`, {
    method: 'POST',
    body,
  })
  return res as MetaPostResult
}

// =============================================================================
// Posting — Instagram (Two-Step Publish Flow with Status Polling)
// =============================================================================

export interface InstagramPostInput {
  imageUrl: string
  caption: string
}

/** Instagram container status codes returned by the Graph API */
type IgContainerStatus = 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED' | 'ERROR' | 'EXPIRED'

export class InstagramPublishError extends Error {
  public readonly statusCode: IgContainerStatus
  constructor(statusCode: IgContainerStatus, message: string) {
    super(message)
    this.name = 'InstagramPublishError'
    this.statusCode = statusCode
  }
}

/**
 * Post to Instagram Business Account.
 * Step 1: Create a media container with the image URL and caption.
 * Step 2: Poll container status until FINISHED (max 10 polls, 3s interval).
 * Step 3: Publish the container.
 *
 * Handles explicit error cases:
 * - Rate limit: 25 posts per 24 hours (Meta error code 32 or 4)
 * - Invalid aspect ratio: Meta returns error on container creation
 * - Media URL not accessible: Meta returns error on container creation
 */
export async function postToInstagram(
  igAccountId: string,
  pageToken: string,
  input: InstagramPostInput
): Promise<MetaPostResult> {
  // Step 1: Create media container
  // TODO: Meta requires the image URL to be publicly accessible. Supabase Storage URLs are public by default.
  let containerId: string
  try {
    const containerRes = await metaFetch(`/${igAccountId}/media`, {
      method: 'POST',
      body: {
        image_url: input.imageUrl,
        caption: input.caption,
        access_token: pageToken,
      },
    })
    containerId = (containerRes as { id: string }).id
  } catch (err) {
    if (err instanceof MetaError) {
      // Detect specific IG container creation failures
      const msg = err.message.toLowerCase()
      if (msg.includes('aspect ratio')) {
        throw new InstagramPublishError('ERROR', `Invalid aspect ratio: Instagram requires images between 4:5 and 1.91:1. Original error: ${err.message}`)
      }
      if (msg.includes('url') || msg.includes('download') || msg.includes('fetch') || msg.includes('accessible')) {
        throw new InstagramPublishError('ERROR', `Media URL not accessible: Ensure the image is publicly available. Original error: ${err.message}`)
      }
      if (err.isRateLimited) {
        throw new InstagramPublishError('ERROR', `Instagram rate limit reached (25 posts per 24 hours). Try again later. Original error: ${err.message}`)
      }
    }
    throw err
  }

  // Step 2: Poll container status until FINISHED or ERROR (max 10 polls, 3s interval)
  const MAX_POLLS = 10
  const POLL_INTERVAL_MS = 3000

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))

    const statusRes = await metaFetch(
      `/${containerId}?fields=status_code,status&access_token=${pageToken}`
    )
    const statusData = statusRes as { status_code?: IgContainerStatus; status?: string }
    const statusCode = statusData.status_code

    console.log(`[Instagram] Container ${containerId} poll ${i + 1}/${MAX_POLLS}: status_code=${statusCode}`)

    if (statusCode === 'FINISHED') {
      break
    }

    if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
      throw new InstagramPublishError(
        statusCode,
        `Instagram container failed with status ${statusCode}: ${statusData.status || 'Unknown error'}`
      )
    }

    // If we've exhausted all polls and still IN_PROGRESS, fail
    if (i === MAX_POLLS - 1) {
      throw new InstagramPublishError(
        'IN_PROGRESS',
        `Instagram container still processing after ${MAX_POLLS} polls (${MAX_POLLS * POLL_INTERVAL_MS / 1000}s). Container ID: ${containerId}`
      )
    }
  }

  // Step 3: Publish the container
  const publishRes = await metaFetch(`/${igAccountId}/media_publish`, {
    method: 'POST',
    body: {
      creation_id: containerId,
      access_token: pageToken,
    },
  })

  return publishRes as MetaPostResult
}

// =============================================================================
// Metrics / Insights
// =============================================================================

/**
 * Get engagement metrics for a Facebook Page post.
 */
export async function getPostInsights(
  postId: string,
  pageToken: string
): Promise<MetaPostInsights> {
  // Fetch basic post engagement fields
  const res = await metaFetch(
    `/${postId}?fields=insights.metric(post_impressions,post_impressions_unique,post_clicks,post_reactions_like_total),comments.summary(true),shares&access_token=${pageToken}`
  )

  const data = res as {
    insights?: { data: Array<{ name: string; values: Array<{ value: number }> }> }
    comments?: { summary?: { total_count: number } }
    shares?: { count: number }
  }

  const insightsMap: Record<string, number> = {}
  if (data.insights?.data) {
    for (const metric of data.insights.data) {
      insightsMap[metric.name] = metric.values?.[0]?.value ?? 0
    }
  }

  return {
    impressions: insightsMap['post_impressions'] ?? 0,
    reach: insightsMap['post_impressions_unique'] ?? 0,
    clicks: insightsMap['post_clicks'] ?? 0,
    reactions: insightsMap['post_reactions_like_total'] ?? 0,
    comments: data.comments?.summary?.total_count ?? 0,
    shares: data.shares?.count ?? 0,
  }
}

/**
 * Get engagement metrics for an Instagram media object.
 */
export async function getIgMediaInsights(
  mediaId: string,
  pageToken: string
): Promise<MetaPostInsights> {
  const res = await metaFetch(
    `/${mediaId}/insights?metric=impressions,reach,likes,comments,shares,saved&access_token=${pageToken}`
  )

  const data = res as { data: Array<{ name: string; values: Array<{ value: number }> }> }

  const insightsMap: Record<string, number> = {}
  if (data.data) {
    for (const metric of data.data) {
      insightsMap[metric.name] = metric.values?.[0]?.value ?? 0
    }
  }

  return {
    impressions: insightsMap['impressions'] ?? 0,
    reach: insightsMap['reach'] ?? 0,
    clicks: 0, // IG media insights don't have a direct clicks metric
    reactions: insightsMap['likes'] ?? 0,
    comments: insightsMap['comments'] ?? 0,
    shares: insightsMap['shares'] ?? 0,
  }
}

// =============================================================================
// Core Fetch Wrapper with Error Handling
// =============================================================================

interface MetaFetchOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: Record<string, string>
}

/**
 * Low-level Meta Graph API fetch wrapper.
 * - Automatically prefixes the Graph API base URL
 * - Parses JSON responses
 * - Throws typed MetaError on API errors
 * - Supports exponential backoff on rate-limit (429) responses
 */
async function metaFetch(
  path: string,
  options: MetaFetchOptions = {},
  retries = 3
): Promise<unknown> {
  const url = `${META_GRAPH_API}${path}`
  const { method = 'GET', body } = options

  const fetchOptions: RequestInit = { method }

  if (body && method === 'POST') {
    fetchOptions.headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
    fetchOptions.body = new URLSearchParams(body).toString()
  }

  const res = await fetch(url, fetchOptions)
  const json = await res.json()

  // Handle Meta API errors
  if (json.error) {
    const metaError = new MetaError(json.error as MetaApiError)

    // Retry on rate limit with exponential backoff
    if (metaError.isRateLimited && retries > 0) {
      const delay = Math.pow(2, 4 - retries) * 1000 // 2s, 4s, 8s
      await new Promise((resolve) => setTimeout(resolve, delay))
      return metaFetch(path, options, retries - 1)
    }

    throw metaError
  }

  if (!res.ok) {
    throw new Error(`Meta API returned ${res.status}: ${JSON.stringify(json)}`)
  }

  return json
}

// =============================================================================
// Utility: Determine escalation severity from a Meta API error
// =============================================================================

export function getEscalationSeverity(
  error: MetaError
): 'info' | 'warning' | 'critical' {
  if (error.isTokenExpired) return 'critical'
  if (error.isPermissionError) return 'critical'
  if (error.isRateLimited) return 'warning'
  return 'info'
}

/**
 * Map a Meta error to the escalation type.
 */
export function getEscalationType(
  error: MetaError
): 'persistent_failure' | 'anomaly_detected' {
  if (error.isTokenExpired || error.isPermissionError) return 'persistent_failure'
  return 'anomaly_detected'
}
