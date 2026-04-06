import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { ensureAuthenticated } from '@/lib/auth'
import { encryptToken } from '@/lib/meta'
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  parseBody,
} from '@/lib/api'

/**
 * POST /api/meta/manual-connect
 *
 * Manual override for Meta Page connection. Allows entering Page ID and
 * Page Access Token directly, bypassing the OAuth /me/accounts call.
 *
 * This is required for Development mode where /me/accounts returns empty
 * without Advanced Access approval. A Meta reviewer can use this to connect
 * a test Page without waiting for App Review.
 */
export async function POST(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const body = await parseBody<{
      businessId: string
      pageId: string
      pageName?: string
      pageToken: string
      igAccountId?: string | null
    }>(request)

    if (!body.businessId) {
      return errorResponse('Business ID is required', 400)
    }
    if (!body.pageId || !body.pageId.trim()) {
      return errorResponse('Page ID is required', 400)
    }
    if (!body.pageToken || !body.pageToken.trim()) {
      return errorResponse('Page Access Token is required', 400)
    }

    const business = await prisma.business.findUnique({
      where: { id: body.businessId },
    })

    if (!business) {
      return errorResponse('Business not found', 404)
    }

    // Encrypt the token before storing
    const encryptedToken = encryptToken(body.pageToken.trim())

    await prisma.business.update({
      where: { id: body.businessId },
      data: {
        metaPageId: body.pageId.trim(),
        metaPageName: body.pageName?.trim() || `Page ${body.pageId.trim()}`,
        metaPageToken: encryptedToken,
        metaIgAccountId: body.igAccountId?.trim() || null,
        metaConnectedAt: new Date(),
        // Manual tokens don't have a known expiry — set to 60 days as a reminder
        metaTokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    })

    await prisma.activityLog.create({
      data: {
        businessId: body.businessId,
        actor: 'human',
        action: 'meta_manual_connected',
        entityType: 'business',
        entityId: body.businessId,
        details: {
          pageId: body.pageId.trim(),
          pageName: body.pageName?.trim() || null,
          hasInstagram: !!body.igAccountId,
          method: 'manual_override',
        },
      },
    })

    return successResponse({ connected: true, pageId: body.pageId.trim() })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to save manual Meta connection')
  }
}
