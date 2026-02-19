import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth'
import { exchangeCodeForToken, getLongLivedToken } from '@/lib/meta'
import prisma from '@/lib/prisma'

/**
 * GET /api/meta/callback?code=xxx&state=xxx
 *
 * Meta OAuth callback. Exchanges the authorization code for a long-lived
 * user token, stores it in a short-lived cookie, and redirects to the
 * business page with a page-selector prompt.
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  // User denied permissions or something went wrong on Meta's side
  if (error) {
    const errorDesc = request.nextUrl.searchParams.get('error_description') || 'Unknown error'
    console.error('Meta OAuth error:', error, errorDesc)
    return NextResponse.redirect(
      new URL(`/businesses?meta_error=${encodeURIComponent(errorDesc)}`, request.url)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/businesses?meta_error=Missing+code+or+state', request.url)
    )
  }

  // Verify CSRF state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('meta-oauth-state')?.value
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL('/businesses?meta_error=Invalid+OAuth+state', request.url)
    )
  }

  // Clear the state cookie
  cookieStore.delete('meta-oauth-state')

  // Extract businessId from state
  const businessId = state.split(':')[0]

  // Look up the business to get its slug for the redirect
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { slug: true },
  })

  if (!business) {
    return NextResponse.redirect(
      new URL('/businesses?meta_error=Business+not+found', request.url)
    )
  }

  try {
    // Exchange code for short-lived token
    const shortLived = await exchangeCodeForToken(code)

    // Exchange for long-lived user token (~60 days)
    const longLived = await getLongLivedToken(shortLived.access_token)

    // Store long-lived user token in a short-lived HTTP-only cookie (10 min)
    // This will be consumed by POST /api/meta/connect when the user picks a page
    cookieStore.set('meta-user-token', longLived.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    })

    // Redirect to business page with meta_connect=pending to trigger page selector
    return NextResponse.redirect(
      new URL(`/businesses/${business.slug}?meta_connect=pending`, request.url)
    )
  } catch (err) {
    console.error('Meta token exchange failed:', err)
    const message = err instanceof Error ? err.message : 'Token exchange failed'
    return NextResponse.redirect(
      new URL(
        `/businesses/${business.slug}?meta_error=${encodeURIComponent(message)}`,
        request.url
      )
    )
  }
}
