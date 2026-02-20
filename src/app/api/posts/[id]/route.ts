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

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/posts/:id - Get single post with full details
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()
    const { id } = await context.params

    const post = await prisma.post.findUnique({
      where: { id },
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
            audienceSegment: true,
            hookSource: true,
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
                      select: { id: true, name: true, slug: true },
                    },
                  },
                },
              },
            },
          },
        },
        performances: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!post) {
      return errorResponse('Post not found', 404)
    }

    return successResponse(post)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch post')
  }
}

// PATCH /api/posts/:id - Retry failed post or cancel scheduled post
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()
    const { id } = await context.params

    const body = await parseBody<{
      action: 'retry' | 'cancel'
    }>(request)

    if (!body.action || !['retry', 'cancel'].includes(body.action)) {
      return errorResponse('Action must be "retry" or "cancel"')
    }

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        content: {
          include: {
            image: { select: { id: true, storageUrl: true } },
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
                        metaPageToken: true,
                        metaIgAccountId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!post) {
      return errorResponse('Post not found', 404)
    }

    const business = post.content.campaign.playbook.business

    // Handle cancel
    if (body.action === 'cancel') {
      if (post.status !== 'scheduled' && post.status !== 'draft') {
        return errorResponse('Can only cancel scheduled or draft posts')
      }

      const updated = await prisma.post.update({
        where: { id },
        data: { status: 'deleted' },
        include: {
          content: {
            select: {
              id: true,
              headline: true,
              campaign: { select: { id: true, name: true } },
            },
          },
        },
      })

      // Check if content has other active posts; if not, revert to approved
      const activePostCount = await prisma.post.count({
        where: {
          contentId: post.contentId,
          status: { in: ['scheduled', 'posting', 'posted'] },
        },
      })
      if (activePostCount === 0) {
        await prisma.content.update({
          where: { id: post.contentId },
          data: { status: 'approved' },
        })
      }

      await prisma.activityLog.create({
        data: {
          businessId: business.id,
          campaignId: post.content.campaign.id,
          actor: 'human',
          action: 'post_cancelled',
          entityType: 'post',
          entityId: id,
          details: {
            platform: post.platform,
            contentHeadline: post.content.headline,
          } as Prisma.InputJsonValue,
        },
      })

      return successResponse(updated)
    }

    // Handle retry
    if (post.status !== 'failed') {
      return errorResponse('Can only retry failed posts')
    }

    if (!business.metaPageId || !business.metaPageToken) {
      return errorResponse('Business does not have a Meta connection')
    }

    if (post.platform === 'instagram' && !business.metaIgAccountId) {
      return errorResponse('Business does not have an Instagram account connected')
    }

    // Set status to posting
    await prisma.post.update({
      where: { id },
      data: { status: 'posting', errorMessage: null },
    })

    // Build message
    const messageParts: string[] = []
    if (post.content.headline) messageParts.push(post.content.headline)
    if (post.content.body) messageParts.push(post.content.body)
    if (post.content.ctaText) messageParts.push(post.content.ctaText)
    const message = messageParts.join('\n\n')

    let pageToken: string
    try {
      pageToken = decryptToken(business.metaPageToken!)
    } catch {
      await prisma.post.update({
        where: { id },
        data: { status: 'failed', errorMessage: 'Failed to decrypt Meta page token' },
      })
      return errorResponse('Failed to decrypt Meta page token', 500)
    }

    try {
      let platformPostId: string

      if (post.platform === 'facebook') {
        const result = await postToFacebook(business.metaPageId!, pageToken, {
          message,
          link: post.content.ctaUrl || undefined,
          imageUrl: post.content.image?.storageUrl || undefined,
        })
        platformPostId = result.id
      } else {
        if (!post.content.image?.storageUrl) {
          await prisma.post.update({
            where: { id },
            data: { status: 'failed', errorMessage: 'Instagram posts require an image' },
          })
          return errorResponse('Instagram posts require an image')
        }
        const caption = post.content.ctaUrl
          ? `${message}\n\n${post.content.ctaUrl}`
          : message
        const result = await postToInstagram(business.metaIgAccountId!, pageToken, {
          imageUrl: post.content.image.storageUrl,
          caption,
        })
        platformPostId = result.id
      }

      const updatedPost = await prisma.post.update({
        where: { id },
        data: {
          status: 'posted',
          platformPostId,
          postedAt: new Date(),
          errorMessage: null,
        },
        include: {
          content: {
            select: {
              id: true,
              headline: true,
              campaign: { select: { id: true, name: true } },
            },
          },
        },
      })

      // Update content status
      await prisma.content.update({
        where: { id: post.contentId },
        data: { status: 'posted' },
      })

      await prisma.activityLog.create({
        data: {
          businessId: business.id,
          campaignId: post.content.campaign.id,
          actor: 'system',
          action: 'post_retried_success',
          entityType: 'post',
          entityId: id,
          details: {
            platform: post.platform,
            platformPostId,
          } as Prisma.InputJsonValue,
        },
      })

      return successResponse(updatedPost)
    } catch (err) {
      const errorMessage = err instanceof MetaError
        ? `Meta API Error (${err.code}): ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Unknown posting error'

      await prisma.post.update({
        where: { id },
        data: { status: 'failed', errorMessage },
      })

      const severity = err instanceof MetaError ? getEscalationSeverity(err) : 'warning'
      const escalationType = err instanceof MetaError ? getEscalationType(err) : 'persistent_failure'

      await prisma.escalation.create({
        data: {
          campaignId: post.content.campaign.id,
          type: escalationType,
          severity,
          title: `Post Retry Failed: ${post.content.headline || 'Untitled'} on ${post.platform}`,
          description: errorMessage,
          status: 'open',
        },
      })

      await prisma.activityLog.create({
        data: {
          businessId: business.id,
          campaignId: post.content.campaign.id,
          actor: 'system',
          action: 'post_retried_failed',
          entityType: 'post',
          entityId: id,
          details: {
            platform: post.platform,
            error: errorMessage,
          } as Prisma.InputJsonValue,
        },
      })

      return errorResponse(`Retry failed: ${errorMessage}`, 502)
    }
  } catch (error) {
    return serverErrorResponse(error, 'Failed to update post')
  }
}
