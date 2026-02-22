import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { Prisma } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

// PATCH /api/recommendations/:id — Accept or dismiss a recommendation
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()

    const { id } = await context.params
    const body = await parseBody<{
      action: 'accept' | 'dismiss'
    }>(request)

    if (!body.action || !['accept', 'dismiss'].includes(body.action)) {
      return errorResponse('action must be "accept" or "dismiss"', 400)
    }

    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            playbook: {
              select: { businessId: true },
            },
          },
        },
      },
    })

    if (!recommendation) {
      return errorResponse('Recommendation not found', 404)
    }

    if (recommendation.status !== 'pending') {
      return errorResponse(`Recommendation is already ${recommendation.status}`, 400)
    }

    if (body.action === 'dismiss') {
      const updated = await prisma.recommendation.update({
        where: { id },
        data: { status: 'dismissed' },
      })

      await prisma.activityLog.create({
        data: {
          businessId: recommendation.campaign.playbook.businessId,
          campaignId: recommendation.campaignId,
          actor: 'human',
          action: 'recommendation_dismissed',
          entityType: 'recommendation',
          entityId: id,
          details: { type: recommendation.type, title: recommendation.title } as Prisma.InputJsonValue,
        },
      })

      return successResponse(updated)
    }

    // Accept action
    const actionData = recommendation.actionData as Record<string, unknown>
    let outcome = ''

    if (recommendation.type === 'retire') {
      // Retire specified content
      const contentIds = actionData.contentIds as string[] | undefined
      if (contentIds && contentIds.length > 0) {
        await prisma.content.updateMany({
          where: { id: { in: contentIds } },
          data: { status: 'retired' },
        })
        outcome = `Retired ${contentIds.length} content pieces`
      } else {
        outcome = 'No content IDs specified — review manually'
      }
    } else {
      // amplify, test, iterate — mark as executed, content generation would happen via the auto-gen pipeline
      outcome = `Recommendation accepted — ${recommendation.type} action queued for next content generation cycle`
    }

    const updated = await prisma.recommendation.update({
      where: { id },
      data: {
        status: 'executed',
        outcome,
      },
    })

    await prisma.activityLog.create({
      data: {
        businessId: recommendation.campaign.playbook.businessId,
        campaignId: recommendation.campaignId,
        actor: 'human',
        action: 'recommendation_accepted',
        entityType: 'recommendation',
        entityId: id,
        details: {
          type: recommendation.type,
          title: recommendation.title,
          outcome,
        } as Prisma.InputJsonValue,
      },
    })

    return successResponse(updated)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    return serverErrorResponse(error, 'Failed to update recommendation')
  }
}
