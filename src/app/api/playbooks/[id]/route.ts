import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { Prisma } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/playbooks/:id - Get playbook details
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()

    const { id } = await context.params

    const playbook = await prisma.playbook.findUnique({
      where: { id },
      include: {
        business: {
          select: { id: true, name: true, slug: true, brandColors: true },
        },
        campaigns: {
          select: { id: true, name: true, status: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { campaigns: true },
        },
      },
    })

    if (!playbook) {
      return errorResponse('Playbook not found', 404)
    }

    return successResponse(playbook)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch playbook')
  }
}

// PUT /api/playbooks/:id - Update playbook
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()

    const { id } = await context.params
    const body = await parseBody<{
      name?: string
      positioning?: string
      founderStory?: string
      audiences?: Record<string, unknown>[]
      keyMessages?: Record<string, unknown>
      objectionHandlers?: Record<string, unknown>
      hooks?: Record<string, unknown>[]
      visualDirection?: Record<string, unknown>
      content?: Record<string, unknown>
      status?: 'draft' | 'active' | 'archived'
    }>(request)

    // Check playbook exists
    const existing = await prisma.playbook.findUnique({
      where: { id },
    })

    if (!existing) {
      return errorResponse('Playbook not found', 404)
    }

    const updateData: Prisma.PlaybookUpdateInput = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.positioning !== undefined) updateData.positioning = body.positioning
    if (body.founderStory !== undefined) updateData.founderStory = body.founderStory
    if (body.audiences !== undefined) updateData.audiences = body.audiences as Prisma.InputJsonValue
    if (body.keyMessages !== undefined) updateData.keyMessages = body.keyMessages as Prisma.InputJsonValue
    if (body.objectionHandlers !== undefined) updateData.objectionHandlers = body.objectionHandlers as Prisma.InputJsonValue
    if (body.hooks !== undefined) updateData.hooks = body.hooks as Prisma.InputJsonValue
    if (body.visualDirection !== undefined) updateData.visualDirection = body.visualDirection as Prisma.InputJsonValue
    if (body.content !== undefined) updateData.content = body.content as Prisma.InputJsonValue
    if (body.status !== undefined) updateData.status = body.status

    // Increment version if content changed
    if (body.content !== undefined || body.hooks !== undefined || body.audiences !== undefined) {
      updateData.version = { increment: 1 }
    }

    const playbook = await prisma.playbook.update({
      where: { id },
      data: updateData,
      include: {
        business: {
          select: { id: true, name: true, slug: true },
        },
      },
    })

    return successResponse(playbook)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to update playbook')
  }
}

// DELETE /api/playbooks/:id - Delete playbook
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()

    const { id } = await context.params

    // Check playbook exists
    const existing = await prisma.playbook.findUnique({
      where: { id },
      include: {
        _count: { select: { campaigns: true } },
      },
    })

    if (!existing) {
      return errorResponse('Playbook not found', 404)
    }

    // Warn if has campaigns
    if (existing._count.campaigns > 0) {
      return errorResponse(
        `Cannot delete playbook with ${existing._count.campaigns} associated campaigns. Archive it instead.`,
        400
      )
    }

    await prisma.playbook.delete({
      where: { id },
    })

    return successResponse({ deleted: true })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to delete playbook')
  }
}
