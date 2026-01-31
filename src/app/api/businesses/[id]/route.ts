import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  serverErrorResponse,
  parseBody,
} from '@/lib/api'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/businesses/:id - Get business details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const { id } = await params

    // Support lookup by ID or slug
    const business = await prisma.business.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        playbooks: {
          orderBy: { updatedAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            playbooks: true,
            images: true,
            conversions: true,
          },
        },
      },
    })

    if (!business) {
      return notFoundResponse('Business not found')
    }

    return successResponse(business)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch business')
  }
}

// PUT /api/businesses/:id - Update business
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const { id } = await params

    // Find the business first
    const existing = await prisma.business.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
    })

    if (!existing) {
      return notFoundResponse('Business not found')
    }

    interface UpdateBusinessInput {
      name?: string
      slug?: string
      description?: string
      websiteUrl?: string
      brandColors?: Record<string, string>
      metaPageId?: string
      metaIgId?: string
      metaAdAccount?: string
      pixelId?: string
      settings?: Record<string, unknown>
    }

    const body = await parseBody<UpdateBusinessInput>(request)

    // If updating slug, check for conflicts
    if (body.slug && body.slug !== existing.slug) {
      const slugConflict = await prisma.business.findUnique({
        where: { slug: body.slug },
      })
      if (slugConflict) {
        return errorResponse('A business with this slug already exists', 409)
      }
    }

    const business = await prisma.business.update({
      where: { id: existing.id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.slug && { slug: body.slug }),
        ...(body.description !== undefined && { description: body.description?.trim() }),
        ...(body.websiteUrl !== undefined && { websiteUrl: body.websiteUrl?.trim() }),
        ...(body.brandColors && { brandColors: body.brandColors }),
        ...(body.metaPageId !== undefined && { metaPageId: body.metaPageId }),
        ...(body.metaIgId !== undefined && { metaIgId: body.metaIgId }),
        ...(body.metaAdAccount !== undefined && { metaAdAccount: body.metaAdAccount }),
        ...(body.pixelId !== undefined && { pixelId: body.pixelId }),
        ...(body.settings && { settings: body.settings }),
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        businessId: business.id,
        actor: 'human',
        action: 'business_updated',
        entityType: 'business',
        entityId: business.id,
        details: { changes: Object.keys(body) },
      },
    })

    return successResponse(business)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to update business')
  }
}

// DELETE /api/businesses/:id - Delete business
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const { id } = await params

    // Find the business first
    const existing = await prisma.business.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
    })

    if (!existing) {
      return notFoundResponse('Business not found')
    }

    // Delete the business (cascades to related records due to schema)
    await prisma.business.delete({
      where: { id: existing.id },
    })

    return successResponse({ message: 'Business deleted successfully' })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to delete business')
  }
}
