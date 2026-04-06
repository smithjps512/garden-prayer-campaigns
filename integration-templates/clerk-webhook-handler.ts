/**
 * Clerk Webhook Handler — /api/webhooks/clerk
 *
 * Drop this into both gameview.ai and melissaforeducators.ai marketing sites.
 * Listens for `user.created` events from Clerk, reads campaign attribution
 * from the cookie, and reports the signup to the Campaign Engine.
 *
 * Required env vars:
 *   CLERK_WEBHOOK_SECRET           — Clerk webhook signing secret
 *   CAMPAIGN_ENGINE_WEBHOOK_URL    — e.g., https://campaigns.gardenprayerpublishing.com/api/webhooks/conversion
 *   CAMPAIGN_ENGINE_WEBHOOK_SECRET — shared secret for authenticating with Campaign Engine
 *
 * Setup:
 * 1. In Clerk Dashboard → Webhooks → Add Endpoint
 * 2. URL: https://your-site.com/api/webhooks/clerk
 * 3. Events: user.created
 * 4. Copy the signing secret to CLERK_WEBHOOK_SECRET env var
 */

import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix' // Clerk uses svix for webhook verification
import { headers } from 'next/headers'
import { getAttributionFromCookieHeader } from '../utm-cookie-capture'

// TODO: ENV — these must be set in the marketing site's environment
const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!
const CAMPAIGN_ENGINE_WEBHOOK_URL = process.env.CAMPAIGN_ENGINE_WEBHOOK_URL!
const CAMPAIGN_ENGINE_WEBHOOK_SECRET = process.env.CAMPAIGN_ENGINE_WEBHOOK_SECRET

interface ClerkUserCreatedEvent {
  type: 'user.created'
  data: {
    id: string
    email_addresses: Array<{ email_address: string }>
    created_at: number
  }
}

export async function POST(request: NextRequest) {
  // Verify the webhook signature using svix
  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await request.text()

  let event: ClerkUserCreatedEvent
  try {
    const wh = new Webhook(CLERK_WEBHOOK_SECRET)
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserCreatedEvent
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  // Only process user.created events
  if (event.type !== 'user.created') {
    return NextResponse.json({ received: true })
  }

  // Read campaign attribution from the cookie header
  // Note: Clerk webhooks are server-to-server, so the cookie won't be present
  // in the webhook payload. You need to pass attribution data via Clerk's
  // unsafeMetadata or publicMetadata when the user signs up.
  // Alternative: read from the request cookie if this is called client-side.
  const cookieHeader = request.headers.get('cookie')
  const attribution = getAttributionFromCookieHeader(cookieHeader)

  // Report signup to Campaign Engine
  try {
    const payload = {
      type: 'signup',
      source: 'clerk',
      userId: event.data.id,
      // Use UTM params from attribution cookie if available
      utm_source: attribution?.utm_source || 'direct',
      utm_medium: attribution?.utm_medium || undefined,
      utm_campaign: attribution?.utm_campaign || undefined,
      utm_content: attribution?.utm_content || undefined,
      campaignSlug: attribution?.utm_campaign || undefined,
    }

    const res = await fetch(CAMPAIGN_ENGINE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CAMPAIGN_ENGINE_WEBHOOK_SECRET
          ? { Authorization: `Bearer ${CAMPAIGN_ENGINE_WEBHOOK_SECRET}` }
          : {}),
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      console.error('[Clerk Webhook] Campaign Engine responded with:', res.status, await res.text())
    }
  } catch (err) {
    console.error('[Clerk Webhook] Failed to report to Campaign Engine:', err)
    // Don't fail the webhook — Clerk will retry on 5xx
  }

  return NextResponse.json({ received: true, userId: event.data.id })
}
