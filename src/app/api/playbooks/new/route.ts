import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'

// POST /api/playbooks/new - Create a draft playbook
export async function POST(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const body = await parseBody<{
      businessId: string
      name?: string
    }>(request)

    if (!body.businessId) {
      return errorResponse('businessId is required', 400)
    }

    // Verify business exists
    const business = await prisma.business.findUnique({
      where: { id: body.businessId },
    })

    if (!business) {
      return errorResponse('Business not found. Provide a valid businessId.', 400)
    }

    const playbook = await prisma.playbook.create({
      data: {
        businessId: body.businessId,
        name: body.name || `${business.name} Playbook`,
        status: 'draft',
      },
    })

    return successResponse(
      { id: playbook.id, businessId: playbook.businessId, status: playbook.status },
      201
    )
  } catch (error) {
    return serverErrorResponse(error, 'Failed to create draft playbook')
  }
}
