import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
  parseBody,
  getQueryParams,
  getPagination,
  paginatedResponse,
} from '@/lib/api'

// GET /api/businesses - List all businesses
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const searchParams = getQueryParams(request)
    const pagination = getPagination(searchParams)
    const search = searchParams.get('search')

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              playbooks: true,
              images: true,
            },
          },
        },
      }),
      prisma.business.count({ where }),
    ])

    return successResponse(paginatedResponse(businesses, total, pagination))
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch businesses')
  }
}

// POST /api/businesses - Create a new business
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    interface CreateBusinessInput {
      name: string
      slug?: string
      description?: string
      websiteUrl?: string
      brandColors?: Record<string, string>
      settings?: Record<string, unknown>
    }

    const body = await parseBody<CreateBusinessInput>(request)

    // Validate required fields
    if (!body.name || body.name.trim().length === 0) {
      return errorResponse('Business name is required', 400)
    }

    // Generate slug if not provided
    const slug =
      body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    // Check if slug already exists
    const existing = await prisma.business.findUnique({
      where: { slug },
    })

    if (existing) {
      return errorResponse('A business with this slug already exists', 409)
    }

    const business = await prisma.business.create({
      data: {
        name: body.name.trim(),
        slug,
        description: body.description?.trim(),
        websiteUrl: body.websiteUrl?.trim(),
        brandColors: body.brandColors as Prisma.InputJsonValue | undefined,
        settings: body.settings as Prisma.InputJsonValue | undefined,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        businessId: business.id,
        actor: 'human',
        action: 'business_created',
        entityType: 'business',
        entityId: business.id,
        details: { name: business.name },
      },
    })

    return successResponse(business, 201)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to create business')
  }
}
