import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/campaigns/:id/complete - Mark campaign as completed
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()
    const { id } = await context.params

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { playbook: { select: { businessId: true } } },
    })

    if (!campaign) {
      return errorResponse('Campaign not found', 404)
    }

    if (campaign.status !== 'live' && campaign.status !== 'paused') {
      return errorResponse(`Campaign cannot be completed from ${campaign.status} status`, 400)
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: { status: 'completed' },
      include: {
        playbook: {
          select: {
            id: true,
            name: true,
            business: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    })

    await prisma.activityLog.create({
      data: {
        businessId: campaign.playbook.businessId,
        campaignId: id,
        actor: 'human',
        action: 'campaign_completed',
        entityType: 'campaign',
        entityId: id,
      },
    })

    return successResponse(updatedCampaign)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to complete campaign')
  }
}
