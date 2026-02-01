import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/campaigns/:id/pause - Pause a live campaign
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

    if (campaign.status !== 'live') {
      return errorResponse(`Campaign cannot be paused from ${campaign.status} status`, 400)
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: { status: 'paused' },
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
        action: 'campaign_paused',
        entityType: 'campaign',
        entityId: id,
      },
    })

    return successResponse(updatedCampaign)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to pause campaign')
  }
}
