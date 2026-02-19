import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { Prisma } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/escalations/:id - Get single escalation
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()
    const { id } = await context.params

    const escalation = await prisma.escalation.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            playbook: {
              include: {
                business: {
                  select: { id: true, name: true, slug: true },
                },
              },
            },
          },
        },
      },
    })

    if (!escalation) {
      return errorResponse('Escalation not found', 404)
    }

    return successResponse(escalation)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch escalation')
  }
}

// PATCH /api/escalations/:id - Update escalation status (acknowledge, resolve, dismiss)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()
    const { id } = await context.params

    const body = await parseBody<{
      action: 'acknowledge' | 'resolve' | 'dismiss'
      humanResponse?: string
    }>(request)

    if (!body.action) {
      return errorResponse('Action is required (acknowledge, resolve, dismiss)', 400)
    }

    const existing = await prisma.escalation.findUnique({
      where: { id },
      include: {
        campaign: {
          select: { id: true, playbook: { select: { businessId: true } } },
        },
      },
    })

    if (!existing) {
      return errorResponse('Escalation not found', 404)
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      open: ['acknowledged', 'resolved', 'dismissed'],
      acknowledged: ['resolved', 'dismissed'],
      resolved: [],
      dismissed: [],
    }

    const statusMap: Record<string, string> = {
      acknowledge: 'acknowledged',
      resolve: 'resolved',
      dismiss: 'dismissed',
    }

    const newStatus = statusMap[body.action]
    const allowed = validTransitions[existing.status] || []

    if (!allowed.includes(newStatus)) {
      return errorResponse(
        `Cannot ${body.action} an escalation with status "${existing.status}"`,
        400
      )
    }

    const updateData: Prisma.EscalationUpdateInput = {
      status: newStatus as 'acknowledged' | 'resolved' | 'dismissed',
    }

    if (body.humanResponse) {
      updateData.humanResponse = body.humanResponse
    }

    if (newStatus === 'resolved') {
      updateData.resolvedAt = new Date()
    }

    const escalation = await prisma.escalation.update({
      where: { id },
      data: updateData,
      include: {
        campaign: {
          include: {
            playbook: {
              include: {
                business: {
                  select: { id: true, name: true, slug: true },
                },
              },
            },
          },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        businessId: existing.campaign.playbook.businessId,
        campaignId: existing.campaignId,
        actor: 'human',
        action: `escalation_${body.action}d`,
        entityType: 'escalation',
        entityId: id,
        details: {
          previousStatus: existing.status,
          newStatus,
          humanResponse: body.humanResponse || null,
        } as Prisma.InputJsonValue,
      },
    })

    return successResponse(escalation)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to update escalation')
  }
}
