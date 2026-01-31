import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { Prisma } from '@prisma/client'

// GET /api/playbooks - List all playbooks
export async function GET(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const status = searchParams.get('status')

    const where: Prisma.PlaybookWhereInput = {}
    if (businessId) where.businessId = businessId
    if (status) where.status = status as Prisma.EnumPlaybookStatusFilter['equals']

    const playbooks = await prisma.playbook.findMany({
      where,
      include: {
        business: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { campaigns: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return successResponse(playbooks)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch playbooks')
  }
}

// POST /api/playbooks - Create a new playbook
export async function POST(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const body = await parseBody<{
      businessId: string
      name: string
      positioning?: string
      founderStory?: string
      audiences?: Record<string, unknown>[]
      keyMessages?: Record<string, unknown>
      objectionHandlers?: Record<string, unknown>
      hooks?: Record<string, unknown>[]
      visualDirection?: Record<string, unknown>
      content?: Record<string, unknown>
    }>(request)

    if (!body.businessId || !body.name) {
      return errorResponse('Business ID and name are required', 400)
    }

    // Verify business exists
    const business = await prisma.business.findUnique({
      where: { id: body.businessId },
    })

    if (!business) {
      return errorResponse('Business not found', 404)
    }

    const playbook = await prisma.playbook.create({
      data: {
        businessId: body.businessId,
        name: body.name,
        positioning: body.positioning,
        founderStory: body.founderStory,
        audiences: body.audiences as Prisma.InputJsonValue | undefined,
        keyMessages: body.keyMessages as Prisma.InputJsonValue | undefined,
        objectionHandlers: body.objectionHandlers as Prisma.InputJsonValue | undefined,
        hooks: body.hooks as Prisma.InputJsonValue | undefined,
        visualDirection: body.visualDirection as Prisma.InputJsonValue | undefined,
        content: body.content as Prisma.InputJsonValue | undefined,
        status: 'draft',
      },
      include: {
        business: {
          select: { id: true, name: true, slug: true },
        },
      },
    })

    return successResponse(playbook, 201)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to create playbook')
  }
}
