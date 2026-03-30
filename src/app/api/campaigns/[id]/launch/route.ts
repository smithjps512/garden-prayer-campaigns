import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/campaigns/:id/launch - Launch an approved campaign
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()
    const { id } = await context.params

    // Get campaign with tasks
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        playbook: { select: { businessId: true } },
        tasks: {
          where: { assignee: 'human', status: { not: 'completed' } },
        },
        _count: { select: { contents: true } },
      },
    })

    if (!campaign) {
      return errorResponse('Campaign not found', 404)
    }

    // Validate campaign can be launched — collect all issues.
    // Common blocking conditions:
    // 1. Campaign not in "approved" or "setup" status (must be approved first)
    // 2. Incomplete human tasks (e.g. "Review Content", "Upload Images", "Setup Meta Ads")
    // 3. No content generated for the campaign
    const issues: string[] = []

    if (campaign.status !== 'approved' && campaign.status !== 'setup') {
      return errorResponse(
        `Campaign cannot be launched from "${campaign.status}" status. ` +
        `It must be in "approved" or "setup" status. Current workflow: draft → approved → setup → live.`,
        400
      )
    }

    if (!campaign.playbook) {
      issues.push('Campaign has no linked playbook — assign a playbook before launching')
    }

    if (campaign.tasks.length > 0) {
      const pendingTasks = campaign.tasks.map((t) => `"${t.title}" (${t.status})`).join(', ')
      issues.push(`Incomplete human tasks that must be finished first: ${pendingTasks}`)
    }

    if (campaign._count.contents === 0) {
      issues.push('No content exists for this campaign — generate at least one piece of content before launching')
    }

    if (issues.length > 0) {
      return errorResponse(
        `Cannot launch campaign "${campaign.name}". Missing prerequisites: ${issues.map((issue, i) => `${i + 1}) ${issue}`).join('. ')}`,
        400
      )
    }

    // Update campaign status
    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: { status: 'live' },
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

    // Log activity
    await prisma.activityLog.create({
      data: {
        businessId: campaign.playbook.businessId,
        campaignId: id,
        actor: 'human',
        action: 'campaign_launched',
        entityType: 'campaign',
        entityId: id,
      },
    })

    return successResponse(updatedCampaign)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to launch campaign')
  }
}
