import { NextRequest, NextResponse } from 'next/server'
import { ensureAuthenticated } from '@/lib/auth'
import { getOAuthUrl } from '@/lib/meta'

// GET /api/meta/auth?businessId=xxx — Redirect to Meta OAuth dialog
export async function GET(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      )
    }

    // Use businessId as the OAuth state param so the callback knows which business to update
    const state = businessId
    const oauthUrl = getOAuthUrl(state)

    return NextResponse.redirect(oauthUrl)
  } catch {
    return NextResponse.redirect(new URL('/businesses', request.url))
  }
}
