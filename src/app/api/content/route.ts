import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { Prisma } from '@prisma/client'

// GET /api/content - List all content
export async function GET(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    const where: Prisma.ContentWhereInput = {}
    if (campaignId) where.campaignId = campaignId
    if (status) where.status = status as Prisma.EnumContentStatusFilter['equals']
    if (type) where.type = type as Prisma.EnumContentTypeFilter['equals']

    const content = await prisma.content.findMany({
      where,
      include: {
        campaign: {
          select: { id: true, name: true, status: true },
        },
        image: {
          select: { id: true, filename: true, storageUrl: true, thumbnailUrl: true },
        },
        _count: {
          select: { posts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(content)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch content')
  }
}

// POST /api/content - Create content manually
export async function POST(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const body = await parseBody<{
      campaignId: string
      type: 'ad' | 'organic_post' | 'story'
      headline?: string
      body?: string
      ctaText?: string
      ctaUrl?: string
      imageId?: string
      hookSource?: string
      audienceSegment?: string
    }>(request)

    if (!body.campaignId) {
      return errorResponse('Campaign ID is required', 400)
    }

    // Verify campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: body.campaignId },
    })

    if (!campaign) {
      return errorResponse('Campaign not found', 404)
    }

    const content = await prisma.content.create({
      data: {
        campaignId: body.campaignId,
        type: body.type || 'organic_post',
        status: 'generated',
        headline: body.headline,
        body: body.body,
        ctaText: body.ctaText,
        ctaUrl: body.ctaUrl,
        imageId: body.imageId,
        hookSource: body.hookSource,
        audienceSegment: body.audienceSegment,
      },
      include: {
        campaign: {
          select: { id: true, name: true },
        },
        image: {
          select: { id: true, filename: true, storageUrl: true },
        },
      },
    })

    return successResponse(content, 201)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to create content')
  }
}
