import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { Prisma } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/campaigns/:id - Get campaign with full details
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()

    const { id } = await context.params

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        playbook: {
          select: {
            id: true,
            name: true,
            positioning: true,
            audiences: true,
            hooks: true,
            business: {
              select: { id: true, name: true, slug: true, brandColors: true },
            },
          },
        },
        contents: {
          select: {
            id: true,
            type: true,
            status: true,
            headline: true,
            body: true,
            ctaText: true,
            hookSource: true,
            audienceSegment: true,
            performanceScore: true,
            createdAt: true,
            image: {
              select: { id: true, storageUrl: true, thumbnailUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        tasks: {
          select: {
            id: true,
            assignee: true,
            type: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
          },
          orderBy: [{ status: 'asc' }, { priority: 'desc' }],
        },
        escalations: {
          where: { status: { in: ['open', 'acknowledged'] } },
          select: {
            id: true,
            type: true,
            severity: true,
            title: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: { contents: true, tasks: true, escalations: true },
        },
      },
    })

    if (!campaign) {
      return errorResponse('Campaign not found', 404)
    }

    return successResponse(campaign)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch campaign')
  }
}

// PUT /api/campaigns/:id - Update campaign
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()

    const { id } = await context.params
    const body = await parseBody<{
      name?: string
      targetAudience?: string
      targetMarkets?: string[]
      channels?: string[]
      budgetDaily?: number
      budgetTotal?: number
      startDate?: string
      endDate?: string
      successMetrics?: Record<string, unknown>
      performanceThresholds?: Record<string, unknown>
      autoOptimize?: boolean
    }>(request)

    // Check campaign exists
    const existing = await prisma.campaign.findUnique({
      where: { id },
      include: { playbook: { select: { businessId: true } } },
    })

    if (!existing) {
      return errorResponse('Campaign not found', 404)
    }

    // Don't allow edits to live campaigns (except pause)
    if (existing.status === 'live') {
      return errorResponse('Cannot edit a live campaign. Pause it first.', 400)
    }

    const updateData: Prisma.CampaignUpdateInput = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.targetAudience !== undefined) updateData.targetAudience = body.targetAudience
    if (body.targetMarkets !== undefined) updateData.targetMarkets = body.targetMarkets as Prisma.InputJsonValue
    if (body.channels !== undefined) updateData.channels = body.channels as Prisma.InputJsonValue
    if (body.budgetDaily !== undefined) updateData.budgetDaily = body.budgetDaily
    if (body.budgetTotal !== undefined) updateData.budgetTotal = body.budgetTotal
    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate)
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null
    if (body.successMetrics !== undefined) updateData.successMetrics = body.successMetrics as Prisma.InputJsonValue
    if (body.performanceThresholds !== undefined) updateData.performanceThresholds = body.performanceThresholds as Prisma.InputJsonValue
    if (body.autoOptimize !== undefined) updateData.autoOptimize = body.autoOptimize

    const campaign = await prisma.campaign.update({
      where: { id },
      data: updateData,
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
        businessId: existing.playbook.businessId,
        campaignId: id,
        actor: 'human',
        action: 'campaign_updated',
        entityType: 'campaign',
        entityId: id,
        details: { changes: Object.keys(body) } as Prisma.InputJsonValue,
      },
    })

    return successResponse(campaign)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to update campaign')
  }
}

// DELETE /api/campaigns/:id - Delete campaign
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()

    const { id } = await context.params

    // Check campaign exists
    const existing = await prisma.campaign.findUnique({
      where: { id },
      include: { playbook: { select: { businessId: true } } },
    })

    if (!existing) {
      return errorResponse('Campaign not found', 404)
    }

    // Don't allow deleting live campaigns
    if (existing.status === 'live') {
      return errorResponse('Cannot delete a live campaign. Complete or pause it first.', 400)
    }

    await prisma.campaign.delete({
      where: { id },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        businessId: existing.playbook.businessId,
        actor: 'human',
        action: 'campaign_deleted',
        entityType: 'campaign',
        entityId: id,
        details: { name: existing.name } as Prisma.InputJsonValue,
      },
    })

    return successResponse({ deleted: true })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to delete campaign')
  }
}
