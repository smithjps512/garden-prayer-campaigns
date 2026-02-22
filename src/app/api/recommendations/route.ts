import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'

// GET /api/recommendations — List recommendations with filters
export async function GET(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const campaignId = searchParams.get('campaignId')
    const businessId = searchParams.get('businessId')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (type) where.type = type
    if (campaignId) where.campaignId = campaignId
    if (businessId) {
      where.campaign = {
        playbook: { businessId },
      }
    }

    const recommendations = await prisma.recommendation.findMany({
      where,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            playbook: {
              select: {
                business: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Summary stats
    const allRecs = await prisma.recommendation.groupBy({
      by: ['status'],
      _count: true,
      ...(businessId ? {
        where: {
          campaign: { playbook: { businessId } },
        },
      } : {}),
    })

    const stats = {
      pending: 0,
      accepted: 0,
      dismissed: 0,
      executed: 0,
    }

    for (const group of allRecs) {
      if (group.status in stats) {
        stats[group.status as keyof typeof stats] = group._count
      }
    }

    return successResponse({
      recommendations,
      stats,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    return serverErrorResponse(error, 'Failed to fetch recommendations')
  }
}
