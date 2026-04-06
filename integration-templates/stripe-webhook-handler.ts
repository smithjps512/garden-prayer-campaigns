/**
 * Stripe Webhook Handler — /api/webhooks/stripe
 *
 * Drop this into both gameview.ai and melissaforeducators.ai marketing sites.
 * Listens for `checkout.session.completed` events from Stripe and reports
 * the purchase to the Campaign Engine for conversion tracking.
 *
 * Required env vars:
 *   STRIPE_WEBHOOK_SECRET           — Stripe webhook signing secret (whsec_...)
 *   CAMPAIGN_ENGINE_WEBHOOK_URL     — e.g., https://campaigns.gardenprayerpublishing.com/api/webhooks/conversion
 *   CAMPAIGN_ENGINE_WEBHOOK_SECRET  — shared secret for authenticating with Campaign Engine
 *
 * When creating a Stripe Checkout Session, pass campaign attribution in metadata:
 *
 *   const session = await stripe.checkout.sessions.create({
 *     // ... other params
 *     metadata: {
 *       campaignSlug: attribution?.utm_campaign || '',
 *       utm_source: attribution?.utm_source || '',
 *       utm_medium: attribution?.utm_medium || '',
 *       utm_content: attribution?.utm_content || '',
 *     },
 *   })
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// TODO: ENV — these must be set in the marketing site's environment
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!
const CAMPAIGN_ENGINE_WEBHOOK_URL = process.env.CAMPAIGN_ENGINE_WEBHOOK_URL!
const CAMPAIGN_ENGINE_WEBHOOK_SECRET = process.env.CAMPAIGN_ENGINE_WEBHOOK_SECRET

const stripe = new Stripe(STRIPE_SECRET_KEY)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Stripe Webhook] Signature verification failed:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Only process checkout.session.completed events
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session

  // Read campaign attribution from session metadata
  // These must be set when creating the Stripe Checkout Session (see docstring above)
  const campaignSlug = session.metadata?.campaignSlug
  const utmSource = session.metadata?.utm_source
  const utmMedium = session.metadata?.utm_medium
  const utmContent = session.metadata?.utm_content

  const amount = session.amount_total ? session.amount_total / 100 : undefined // Stripe uses cents
  const currency = session.currency || 'usd'

  // Report purchase to Campaign Engine
  try {
    const payload = {
      type: 'purchase',
      source: 'stripe',
      campaignSlug: campaignSlug || undefined,
      amount,
      currency,
      value: amount,
      utm_source: utmSource || 'stripe',
      utm_medium: utmMedium || 'payment',
      utm_campaign: campaignSlug || undefined,
      utm_content: utmContent || undefined,
      sessionId: session.id,
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
      console.error('[Stripe Webhook] Campaign Engine responded with:', res.status, await res.text())
    }
  } catch (err) {
    console.error('[Stripe Webhook] Failed to report to Campaign Engine:', err)
  }

  return NextResponse.json({ received: true, sessionId: session.id })
}
