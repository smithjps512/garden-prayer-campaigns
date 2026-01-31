import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
  getQueryParams,
  getPagination,
  paginatedResponse,
} from '@/lib/api'

// GET /api/images - List images
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const searchParams = getQueryParams(request)
    const pagination = getPagination(searchParams)
    const businessId = searchParams.get('businessId')
    const type = searchParams.get('type')
    const category = searchParams.get('category')

    const where: Record<string, unknown> = {}

    if (businessId) {
      // Support both ID and slug
      const business = await prisma.business.findFirst({
        where: { OR: [{ id: businessId }, { slug: businessId }] },
      })
      if (business) {
        where.businessId = business.id
      }
    }

    if (type) {
      where.type = type
    }

    if (category) {
      where.category = category
    }

    const [images, total] = await Promise.all([
      prisma.image.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          business: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      prisma.image.count({ where }),
    ])

    return successResponse(paginatedResponse(images, total, pagination))
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch images')
  }
}

// POST /api/images - Create image record (after upload)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    interface CreateImageInput {
      businessId: string
      filename: string
      storageUrl: string
      thumbnailUrl?: string
      type?: 'product' | 'generic' | 'video_thumbnail'
      category?: string
      tags?: {
        segments?: string[]
        emotions?: string[]
        themes?: string[]
      }
      altText?: string
      width?: number
      height?: number
      fileSize?: number
      mimeType?: string
    }

    const body: CreateImageInput = await request.json()

    // Validate required fields
    if (!body.businessId || !body.filename || !body.storageUrl) {
      return errorResponse('businessId, filename, and storageUrl are required', 400)
    }

    // Verify business exists (support slug lookup)
    const business = await prisma.business.findFirst({
      where: { OR: [{ id: body.businessId }, { slug: body.businessId }] },
    })

    if (!business) {
      return errorResponse('Business not found', 404)
    }

    const image = await prisma.image.create({
      data: {
        businessId: business.id,
        filename: body.filename,
        storageUrl: body.storageUrl,
        thumbnailUrl: body.thumbnailUrl,
        type: body.type || 'generic',
        category: body.category,
        tags: body.tags,
        altText: body.altText,
        width: body.width,
        height: body.height,
        fileSize: body.fileSize,
        mimeType: body.mimeType,
      },
      include: {
        business: {
          select: { id: true, name: true, slug: true },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        businessId: business.id,
        actor: 'human',
        action: 'image_uploaded',
        entityType: 'image',
        entityId: image.id,
        details: { filename: image.filename },
      },
    })

    return successResponse(image, 201)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to create image')
  }
}
