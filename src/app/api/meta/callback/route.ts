import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ensureAuthenticated } from '@/lib/auth'
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getPages,
  getIgAccount,
  getPageAccessToken,
  encryptToken,
} from '@/lib/meta'

// GET /api/meta/callback — Handle Meta OAuth callback
// Meta redirects here with ?code=xxx&state=businessId
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // businessId
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // User denied permissions
  if (error) {
    const msg = encodeURIComponent(errorDescription || 'Meta authorization was denied')
    return NextResponse.redirect(`${appUrl}/businesses?meta_error=${msg}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/businesses?meta_error=${encodeURIComponent('Missing authorization code or state')}`
    )
  }

  try {
    await ensureAuthenticated()
  } catch {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const businessId = state

  // Verify business exists
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) {
    return NextResponse.redirect(
      `${appUrl}/businesses?meta_error=${encodeURIComponent('Business not found')}`
    )
  }

  try {
    // Step 1: Exchange code for short-lived token
    const shortLivedToken = await exchangeCodeForToken(code)

    // Step 2: Exchange for long-lived token (~60 days)
    const longLivedToken = await getLongLivedToken(shortLivedToken.access_token)

    // Step 3: Get the user's Facebook pages
    const pages = await getPages(longLivedToken.access_token)

    if (pages.length === 0) {
      return NextResponse.redirect(
        `${appUrl}/businesses/${business.slug}?meta_error=${encodeURIComponent('No Facebook Pages found. Make sure your account manages at least one Page.')}`
      )
    }

    // For now, auto-select the first page. If user has multiple pages,
    // they'll be able to change via the page selector UI.
    const selectedPage = pages[0]

    // Step 4: Get long-lived page access token
    const pageToken = await getPageAccessToken(longLivedToken.access_token, selectedPage.id)

    // Step 5: Check for Instagram Business Account
    const igAccount = await getIgAccount(selectedPage.id, pageToken)

    // Step 6: Encrypt token and store on business
    const encryptedToken = encryptToken(pageToken)

    const tokenExpiresAt = longLivedToken.expires_in
      ? new Date(Date.now() + longLivedToken.expires_in * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // Default 60 days

    await prisma.business.update({
      where: { id: businessId },
      data: {
        metaPageId: selectedPage.id,
        metaPageName: selectedPage.name,
        metaPageToken: encryptedToken,
        metaIgAccountId: igAccount?.id || null,
        metaConnectedAt: new Date(),
        metaTokenExpiresAt: tokenExpiresAt,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        businessId,
        actor: 'human',
        action: 'meta_connected',
        entityType: 'business',
        entityId: businessId,
        details: {
          pageName: selectedPage.name,
          pageId: selectedPage.id,
          hasInstagram: !!igAccount,
          igUsername: igAccount?.username || null,
        },
      },
    })

    return NextResponse.redirect(
      `${appUrl}/businesses/${business.slug}?meta_connected=true`
    )
  } catch (err) {
    console.error('Meta OAuth callback error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to connect to Meta'
    return NextResponse.redirect(
      `${appUrl}/businesses/${business.slug}?meta_error=${encodeURIComponent(msg)}`
    )
  }
}
