import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/playbooks/:id/activate - Activate playbook (deactivates others for same business)
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()

    const { id } = await context.params

    // Get playbook with business
    const playbook = await prisma.playbook.findUnique({
      where: { id },
      include: { business: true },
    })

    if (!playbook) {
      return errorResponse('Playbook not found', 404)
    }

    // Validate playbook has required content
    if (!playbook.positioning || !playbook.hooks || !playbook.audiences) {
      return errorResponse(
        'Playbook must have positioning, hooks, and audiences defined before activation',
        400
      )
    }

    // Deactivate other playbooks for this business
    await prisma.playbook.updateMany({
      where: {
        businessId: playbook.businessId,
        status: 'active',
        id: { not: id },
      },
      data: { status: 'draft' },
    })

    // Activate this playbook
    const updated = await prisma.playbook.update({
      where: { id },
      data: { status: 'active' },
      include: {
        business: {
          select: { id: true, name: true, slug: true },
        },
      },
    })

    return successResponse(updated)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to activate playbook')
  }
}
