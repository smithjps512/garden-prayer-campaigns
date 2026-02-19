import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth'
import {
  getPages,
  getIgAccount,
  encryptToken,
} from '@/lib/meta'
import prisma from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
  serverErrorResponse,
  parseBody,
} from '@/lib/api'

interface ConnectInput {
  businessId: string
  pageId: string
}

/**
 * POST /api/meta/connect
 *
 * Finalizes Meta connection for a business:
 * 1. Reads the temporary user token from cookie
 * 2. Gets the page access token for the selected page
 * 3. Detects linked Instagram Business account
 * 4. Encrypts the page token and stores everything on the Business model
 */
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const body = await parseBody<ConnectInput>(request)

    if (!body.businessId || !body.pageId) {
      return errorResponse('businessId and pageId are required')
    }

    // Verify business exists
    const business = await prisma.business.findUnique({
      where: { id: body.businessId },
    })
    if (!business) {
      return notFoundResponse('Business not found')
    }

    // Read the temporary user token from cookie
    const cookieStore = await cookies()
    const userToken = cookieStore.get('meta-user-token')?.value

    if (!userToken) {
      return errorResponse(
        'No Meta user token found. Please restart the connection flow.',
        400
      )
    }

    // Get pages to find the selected page's access token
    const pages = await getPages(userToken)
    const selectedPage = pages.find((p) => p.id === body.pageId)

    if (!selectedPage) {
      return errorResponse(
        'Selected page not found. You may not have permission to manage this page.',
        400
      )
    }

    // The page access token from a long-lived user token is itself long-lived
    const pageToken = selectedPage.access_token

    // Detect linked Instagram Business account
    const igAccount = await getIgAccount(body.pageId, pageToken)

    // Encrypt the page token for storage
    const encryptedToken = encryptToken(pageToken)

    // Token expiry: page tokens derived from long-lived user tokens
    // don't expire, but we track the user token's 60-day window
    const tokenExpiresAt = new Date()
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 60)

    // Update business with Meta connection data
    const updated = await prisma.business.update({
      where: { id: body.businessId },
      data: {
        metaPageId: selectedPage.id,
        metaPageName: selectedPage.name,
        metaPageToken: encryptedToken,
        metaIgAccountId: igAccount?.id || null,
        metaConnectedAt: new Date(),
        metaTokenExpiresAt: tokenExpiresAt,
      },
    })

    // Log the activity
    await prisma.activityLog.create({
      data: {
        businessId: body.businessId,
        actor: 'human',
        action: 'meta_connected',
        entityType: 'business',
        entityId: body.businessId,
        details: {
          pageName: selectedPage.name,
          pageId: selectedPage.id,
          igAccountId: igAccount?.id || null,
          igUsername: igAccount?.username || null,
        },
      },
    })

    // Clear the temporary user token cookie
    cookieStore.delete('meta-user-token')

    return successResponse({
      metaPageId: updated.metaPageId,
      metaPageName: updated.metaPageName,
      metaIgAccountId: updated.metaIgAccountId,
      metaConnectedAt: updated.metaConnectedAt,
      metaTokenExpiresAt: updated.metaTokenExpiresAt,
    })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to connect Meta account')
  }
}
