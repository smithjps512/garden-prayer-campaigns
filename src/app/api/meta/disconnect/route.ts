import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'

// POST /api/meta/disconnect — Clear Meta tokens from a business
export async function POST(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const body = await parseBody<{ businessId: string }>(request)

    if (!body.businessId) {
      return errorResponse('businessId is required')
    }

    const business = await prisma.business.findUnique({
      where: { id: body.businessId },
    })

    if (!business) {
      return errorResponse('Business not found', 404)
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

    return successResponse({ disconnected: true })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to disconnect Meta')
  }
}
