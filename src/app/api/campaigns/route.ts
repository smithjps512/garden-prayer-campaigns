import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { Prisma } from '@prisma/client'

// GET /api/campaigns - List all campaigns
export async function GET(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const { searchParams } = new URL(request.url)
    const playbookId = searchParams.get('playbookId')
    const status = searchParams.get('status')
    const businessId = searchParams.get('businessId')

    const where: Prisma.CampaignWhereInput = {}
    if (playbookId) where.playbookId = playbookId
    if (status) where.status = status as Prisma.EnumCampaignStatusFilter['equals']
    if (businessId) {
      where.playbook = { businessId }
    }

    const campaigns = await prisma.campaign.findMany({
      where,
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
        _count: {
          select: { contents: true, tasks: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return successResponse(campaigns)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch campaigns')
  }
}

// POST /api/campaigns - Create a new campaign from playbook
export async function POST(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const body = await parseBody<{
      playbookId: string
      name: string
      targetAudience?: string
      targetMarkets?: string[]
      channels?: string[]
      budgetDaily?: number
      budgetTotal?: number
      startDate?: string
      endDate?: string
      successMetrics?: Record<string, unknown>
      performanceThresholds?: Record<string, unknown>
    }>(request)

    if (!body.playbookId || !body.name) {
      return errorResponse('Playbook ID and name are required', 400)
    }

    // Verify playbook exists
    const playbook = await prisma.playbook.findUnique({
      where: { id: body.playbookId },
      include: { business: true },
    })

    if (!playbook) {
      return errorResponse('Playbook not found', 404)
    }

    const campaign = await prisma.campaign.create({
      data: {
        playbookId: body.playbookId,
        name: body.name,
        status: 'draft',
        targetAudience: body.targetAudience,
        targetMarkets: body.targetMarkets as Prisma.InputJsonValue | undefined,
        channels: body.channels as Prisma.InputJsonValue | undefined,
        budgetDaily: body.budgetDaily,
        budgetTotal: body.budgetTotal,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        successMetrics: body.successMetrics as Prisma.InputJsonValue | undefined,
        performanceThresholds: body.performanceThresholds as Prisma.InputJsonValue | undefined,
      },
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
        businessId: playbook.businessId,
        campaignId: campaign.id,
        actor: 'human',
        action: 'campaign_created',
        entityType: 'campaign',
        entityId: campaign.id,
        details: { name: campaign.name } as Prisma.InputJsonValue,
      },
    })

    return successResponse(campaign, 201)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to create campaign')
  }
}
