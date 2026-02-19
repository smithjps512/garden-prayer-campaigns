import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { Prisma } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/content/:id - Get single content piece
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()
    const { id } = await context.params

    const content = await prisma.content.findUnique({
      where: { id },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
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
        },
        image: {
          select: { id: true, filename: true, storageUrl: true, thumbnailUrl: true },
        },
      },
    })

    if (!content) {
      return errorResponse('Content not found', 404)
    }

    return successResponse(content)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch content')
  }
}

// PUT /api/content/:id - Update content (edit or status change)
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()
    const { id } = await context.params

    const body = await parseBody<{
      headline?: string
      body?: string
      ctaText?: string
      ctaUrl?: string
      status?: 'generated' | 'approved' | 'scheduled' | 'posted' | 'paused' | 'retired'
      imageId?: string | null
    }>(request)

    const existing = await prisma.content.findUnique({
      where: { id },
      include: {
        campaign: {
          select: { playbook: { select: { businessId: true } } },
        },
      },
    })

    if (!existing) {
      return errorResponse('Content not found', 404)
    }

    const updateData: Prisma.ContentUpdateInput = {}
    if (body.headline !== undefined) updateData.headline = body.headline
    if (body.body !== undefined) updateData.body = body.body
    if (body.ctaText !== undefined) updateData.ctaText = body.ctaText
    if (body.ctaUrl !== undefined) updateData.ctaUrl = body.ctaUrl
    if (body.status !== undefined) updateData.status = body.status
    if (body.imageId !== undefined) {
      if (body.imageId === null) {
        updateData.image = { disconnect: true }
      } else {
        updateData.image = { connect: { id: body.imageId } }
      }
    }

    const content = await prisma.content.update({
      where: { id },
      data: updateData,
      include: {
        campaign: {
          select: { id: true, name: true },
        },
        image: {
          select: { id: true, filename: true, storageUrl: true, thumbnailUrl: true },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        businessId: existing.campaign.playbook.businessId,
        campaignId: existing.campaignId,
        actor: 'human',
        action: body.status ? `content_${body.status}` : 'content_updated',
        entityType: 'content',
        entityId: id,
        details: { changes: Object.keys(body) } as Prisma.InputJsonValue,
      },
    })

    return successResponse(content)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to update content')
  }
}

// DELETE /api/content/:id - Delete content
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()
    const { id } = await context.params

    const existing = await prisma.content.findUnique({
      where: { id },
      include: {
        campaign: {
          select: { playbook: { select: { businessId: true } } },
        },
      },
    })

    if (!existing) {
      return errorResponse('Content not found', 404)
    }

    if (existing.status === 'posted') {
      return errorResponse('Cannot delete posted content', 400)
    }

    await prisma.content.delete({ where: { id } })

    await prisma.activityLog.create({
      data: {
        businessId: existing.campaign.playbook.businessId,
        campaignId: existing.campaignId,
        actor: 'human',
        action: 'content_deleted',
        entityType: 'content',
        entityId: id,
        details: { headline: existing.headline } as Prisma.InputJsonValue,
      },
    })

    return successResponse({ deleted: true })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to delete content')
  }
}
