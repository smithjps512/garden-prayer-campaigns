import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { getSession } from '@/lib/auth'
import { getOAuthUrl } from '@/lib/meta'

/**
 * GET /api/meta/auth?businessId=xxx
 *
 * Initiates Meta OAuth flow. Stores CSRF state in a cookie,
 * then redirects the user to Meta's OAuth dialog.
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const businessId = request.nextUrl.searchParams.get('businessId')
  if (!businessId) {
    return NextResponse.json(
      { success: false, error: 'businessId is required' },
      { status: 400 }
    )
  }

  // Generate a nonce for CSRF protection
  const nonce = crypto.randomBytes(16).toString('hex')
  const state = `${businessId}:${nonce}`

  // Store the state in an HTTP-only cookie so we can verify it on callback
  const cookieStore = await cookies()
  cookieStore.set('meta-oauth-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  })

  const oauthUrl = getOAuthUrl(state)
  return NextResponse.redirect(oauthUrl)
}
