import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
  serverErrorResponse,
  parseBody,
} from '@/lib/api'

interface DisconnectInput {
  businessId: string
}

/**
 * POST /api/meta/disconnect
 *
 * Disconnects Meta from a business by clearing all Meta-related fields.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const body = await parseBody<DisconnectInput>(request)

    if (!body.businessId) {
      return errorResponse('businessId is required')
    }

    const business = await prisma.business.findUnique({
      where: { id: body.businessId },
    })
    if (!business) {
      return notFoundResponse('Business not found')
    }

    await prisma.business.update({
      where: { id: body.businessId },
      data: {
        metaPageId: null,
        metaPageName: null,
        metaPageToken: null,
        metaIgAccountId: null,
        metaConnectedAt: null,
        metaTokenExpiresAt: null,
      },
    })

    // Log the activity
    await prisma.activityLog.create({
      data: {
        businessId: body.businessId,
        actor: 'human',
        action: 'meta_disconnected',
        entityType: 'business',
        entityId: body.businessId,
        details: {
          previousPageName: business.metaPageName,
          previousPageId: business.metaPageId,
        },
      },
    })

    return successResponse({ message: 'Meta account disconnected' })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to disconnect Meta account')
  }
}
