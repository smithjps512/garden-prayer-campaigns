import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import {
  decryptToken,
  postToFacebook,
  postToInstagram,
  MetaError,
  getEscalationSeverity,
  getEscalationType,
} from '@/lib/meta'

// GET /api/posts - List posts with optional filters
export async function GET(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')
    const status = searchParams.get('status')
    const platform = searchParams.get('platform')
    const contentId = searchParams.get('contentId')

    const where: Prisma.PostWhereInput = {}
    if (status) where.status = status as Prisma.EnumPostStatusFilter['equals']
    if (platform) where.platform = platform as Prisma.EnumPlatformFilter['equals']
    if (contentId) where.contentId = contentId
    if (campaignId) {
      where.content = { campaignId }
    }

    const posts = await prisma.post.findMany({
      where,
      include: {
        content: {
          select: {
            id: true,
            headline: true,
            body: true,
            ctaText: true,
            ctaUrl: true,
            status: true,
            type: true,
            image: {
              select: { id: true, storageUrl: true, thumbnailUrl: true, filename: true },
            },
            campaign: {
              select: {
                id: true,
                name: true,
                playbook: {
                  select: {
                    business: {
                      select: { id: true, name: true, slug: true, metaPageId: true, metaIgAccountId: true },
                    },
                  },
                },
              },
            },
          },
        },
        _count: {
          select: { performances: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(posts)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch posts')
  }
}

// POST /api/posts - Create a post from approved content
export async function POST(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const body = await parseBody<{
      contentId: string
      platform: 'facebook' | 'instagram'
      scheduledFor?: string // ISO datetime for scheduling; omit for immediate post
    }>(request)

    if (!body.contentId) {
      return errorResponse('Content ID is required')
    }
    if (!body.platform || !['facebook', 'instagram'].includes(body.platform)) {
      return errorResponse('Platform must be "facebook" or "instagram"')
    }

    // Fetch content with full chain: content -> campaign -> playbook -> business
    const content = await prisma.content.findUnique({
      where: { id: body.contentId },
      include: {
        image: {
          select: { id: true, storageUrl: true },
        },
        campaign: {
          select: {
            id: true,
            name: true,
            playbook: {
              select: {
                business: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    metaPageId: true,
                    metaPageName: true,
                    metaPageToken: true,
                    metaIgAccountId: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!content) {
      return errorResponse('Content not found', 404)
    }

    if (content.status !== 'approved' && content.status !== 'scheduled') {
      return errorResponse('Content must be approved before posting')
    }

    const business = content.campaign.playbook.business

    // Validate Meta connection
    if (!business.metaPageId || !business.metaPageToken) {
      return errorResponse('Business does not have a Meta connection. Connect to Meta first.')
    }

    if (body.platform === 'instagram' && !business.metaIgAccountId) {
      return errorResponse('Business does not have an Instagram account connected')
    }

    // Instagram requires an image
    if (body.platform === 'instagram' && !content.image?.storageUrl) {
      return errorResponse('Instagram posts require an image. Assign an image to this content first.')
    }

    // Build the post message from content fields
    const messageParts: string[] = []
    if (content.headline) messageParts.push(content.headline)
    if (content.body) messageParts.push(content.body)
    if (content.ctaText) messageParts.push(content.ctaText)
    const message = messageParts.join('\n\n')

    // If scheduling for later, just create the post record
    if (body.scheduledFor) {
      const scheduledDate = new Date(body.scheduledFor)
      if (isNaN(scheduledDate.getTime())) {
        return errorResponse('Invalid scheduledFor date')
      }
      if (scheduledDate <= new Date()) {
        return errorResponse('Scheduled time must be in the future')
      }

      const post = await prisma.post.create({
        data: {
          contentId: body.contentId,
          platform: body.platform,
          status: 'scheduled',
          scheduledFor: scheduledDate,
        },
        include: {
          content: {
            select: {
              id: true,
              headline: true,
              status: true,
              campaign: { select: { id: true, name: true } },
            },
          },
        },
      })

      // Update content status to scheduled
      await prisma.content.update({
        where: { id: body.contentId },
        data: { status: 'scheduled' },
      })

      // Log activity
      await prisma.activityLog.create({
        data: {
          businessId: business.id,
          campaignId: content.campaign.id,
          actor: 'human',
          action: 'post_scheduled',
          entityType: 'post',
          entityId: post.id,
          details: {
            platform: body.platform,
            scheduledFor: body.scheduledFor,
            contentHeadline: content.headline,
          } as Prisma.InputJsonValue,
        },
      })

      return successResponse(post, 201)
    }

    // Immediate posting: create post record with 'posting' status
    const post = await prisma.post.create({
      data: {
        contentId: body.contentId,
        platform: body.platform,
        status: 'posting',
      },
    })

    // Decrypt the page token
    let pageToken: string
    try {
      pageToken = decryptToken(business.metaPageToken!)
    } catch {
      await prisma.post.update({
        where: { id: post.id },
        data: { status: 'failed', errorMessage: 'Failed to decrypt Meta page token' },
      })
      return errorResponse('Failed to decrypt Meta page token. Try reconnecting to Meta.', 500)
    }

    // Post to the platform
    try {
      let platformPostId: string

      if (body.platform === 'facebook') {
        const result = await postToFacebook(business.metaPageId!, pageToken, {
          message,
          link: content.ctaUrl || undefined,
          imageUrl: content.image?.storageUrl || undefined,
        })
        platformPostId = result.id
      } else {
        // Instagram
        const caption = content.ctaUrl
          ? `${message}\n\n${content.ctaUrl}`
          : message
        const result = await postToInstagram(business.metaIgAccountId!, pageToken, {
          imageUrl: content.image!.storageUrl,
          caption,
        })
        platformPostId = result.id
      }

      // Update post as successful
      const updatedPost = await prisma.post.update({
        where: { id: post.id },
        data: {
          status: 'posted',
          platformPostId,
          postedAt: new Date(),
        },
        include: {
          content: {
            select: {
              id: true,
              headline: true,
              status: true,
              campaign: { select: { id: true, name: true } },
            },
          },
        },
      })

      // Update content status to posted
      await prisma.content.update({
        where: { id: body.contentId },
        data: { status: 'posted' },
      })

      // Log success
      await prisma.activityLog.create({
        data: {
          businessId: business.id,
          campaignId: content.campaign.id,
          actor: 'system',
          action: 'post_published',
          entityType: 'post',
          entityId: post.id,
          details: {
            platform: body.platform,
            platformPostId,
            contentHeadline: content.headline,
          } as Prisma.InputJsonValue,
        },
      })

      return successResponse(updatedPost, 201)
    } catch (err) {
      // Post failed - update status and create escalation
      const errorMessage = err instanceof MetaError
        ? `Meta API Error (${err.code}): ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Unknown posting error'

      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: 'failed',
          errorMessage,
        },
      })

      // Create escalation for the failure
      const severity = err instanceof MetaError ? getEscalationSeverity(err) : 'warning'
      const escalationType = err instanceof MetaError ? getEscalationType(err) : 'persistent_failure'

      await prisma.escalation.create({
        data: {
          campaignId: content.campaign.id,
          type: escalationType,
          severity,
          title: `Post Failed: ${content.headline || 'Untitled'} on ${body.platform}`,
          description: errorMessage,
          status: 'open',
        },
      })

      // Log failure
      await prisma.activityLog.create({
        data: {
          businessId: business.id,
          campaignId: content.campaign.id,
          actor: 'system',
          action: 'post_failed',
          entityType: 'post',
          entityId: post.id,
          details: {
            platform: body.platform,
            error: errorMessage,
            contentHeadline: content.headline,
          } as Prisma.InputJsonValue,
        },
      })

      return errorResponse(`Failed to post to ${body.platform}: ${errorMessage}`, 502)
    }
  } catch (error) {
    return serverErrorResponse(error, 'Failed to create post')
  }
}
