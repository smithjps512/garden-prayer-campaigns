import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, serverErrorResponse } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { Prisma } from '@prisma/client'

// GET /api/escalations - List escalations
export async function GET(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const severity = searchParams.get('severity')
    const campaignId = searchParams.get('campaignId')

    const where: Prisma.EscalationWhereInput = {}

    if (status === 'active') {
      where.status = { in: ['open', 'acknowledged'] }
    } else if (status) {
      where.status = status as Prisma.EnumEscalationStatusFilter['equals']
    }

    if (severity) {
      where.severity = severity as Prisma.EnumEscalationSeverityFilter['equals']
    }

    if (campaignId) {
      where.campaignId = campaignId
    }

    const escalations = await prisma.escalation.findMany({
      where,
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
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    })

    return successResponse(escalations)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch escalations')
  }
}
