import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'
import { Prisma } from '@prisma/client'
import {
  decryptToken,
  postToFacebook,
  postToInstagram,
  MetaError,
  getEscalationSeverity,
  getEscalationType,
} from '@/lib/meta'
import { appendUTMToUrl, type UTMParams } from '@/lib/utm'

/**
 * GET /api/cron/process-posts
 *
 * Vercel Cron Job — runs every 5 minutes.
 * Picks up scheduled posts whose scheduledFor <= now, posts them to Meta,
 * and updates their status to posted or failed.
 */
export async function GET(request: NextRequest) {
  try {
    // Validate CRON_SECRET bearer token
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return errorResponse('CRON_SECRET not configured', 500)
    }
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401)
    }

    const now = new Date()

    // Find scheduled posts ready to be processed
    const posts = await prisma.post.findMany({
      where: {
        scheduledFor: { lte: now },
        status: 'scheduled',
      },
      orderBy: { scheduledFor: 'asc' },
      take: 10,
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

    if (posts.length === 0) {
      return successResponse({ processed: 0, results: [] })
    }

    const results: Array<{
      postId: string
      platform: string
      status: 'posted' | 'failed'
      platformPostId?: string
      error?: string
    }> = []

    // Process each post independently (partial failure handling)
    for (const post of posts) {
      const business = post.content.campaign.playbook.business

      // Validate Meta connection
      if (!business.metaPageId || !business.metaPageToken) {
        const errorMsg = 'Business does not have a Meta connection'
        await prisma.post.update({
          where: { id: post.id },
          data: { status: 'failed', errorMessage: errorMsg },
        })
        await logActivity(business.id, post.content.campaign.id, post.id, post.platform, 'post_cron_failed', { error: errorMsg })
        results.push({ postId: post.id, platform: post.platform, status: 'failed', error: errorMsg })
        continue
      }

      if (post.platform === 'instagram' && !business.metaIgAccountId) {
        const errorMsg = 'No Instagram account connected'
        await prisma.post.update({
          where: { id: post.id },
          data: { status: 'failed', errorMessage: errorMsg },
        })
        await logActivity(business.id, post.content.campaign.id, post.id, post.platform, 'post_cron_failed', { error: errorMsg })
        results.push({ postId: post.id, platform: post.platform, status: 'failed', error: errorMsg })
        continue
      }

      // Set status to posting
      await prisma.post.update({
        where: { id: post.id },
        data: { status: 'posting' },
      })

      // Build message with UTM-tagged CTA URL
      const messageParts: string[] = []
      if (post.content.headline) messageParts.push(post.content.headline)
      if (post.content.body) messageParts.push(post.content.body)
      if (post.content.ctaText) messageParts.push(post.content.ctaText)
      const message = messageParts.join('\n\n')

      // Apply UTM params to CTA URL if stored
      const storedUtm = post.targeting as unknown as UTMParams | null
      const ctaUrl = post.content.ctaUrl && storedUtm
        ? appendUTMToUrl(post.content.ctaUrl, storedUtm)
        : post.content.ctaUrl || undefined

      // Decrypt token
      let pageToken: string
      try {
        pageToken = decryptToken(business.metaPageToken!)
      } catch {
        const errorMsg = 'Failed to decrypt Meta page token'
        await prisma.post.update({
          where: { id: post.id },
          data: { status: 'failed', errorMessage: errorMsg },
        })
        await logActivity(business.id, post.content.campaign.id, post.id, post.platform, 'post_cron_failed', { error: errorMsg })
        results.push({ postId: post.id, platform: post.platform, status: 'failed', error: errorMsg })
        continue
      }

      // Post to Meta
      try {
        let platformPostId: string

        if (post.platform === 'facebook') {
          const result = await postToFacebook(business.metaPageId!, pageToken, {
            message,
            link: ctaUrl,
            imageUrl: post.content.image?.storageUrl || undefined,
          })
          platformPostId = result.id
        } else {
          // Instagram
          if (!post.content.image?.storageUrl) {
            const errorMsg = 'Instagram posts require an image'
            await prisma.post.update({
              where: { id: post.id },
              data: { status: 'failed', errorMessage: errorMsg },
            })
            await logActivity(business.id, post.content.campaign.id, post.id, post.platform, 'post_cron_failed', { error: errorMsg })
            results.push({ postId: post.id, platform: post.platform, status: 'failed', error: errorMsg })
            continue
          }
          const caption = ctaUrl
            ? `${message}\n\n${ctaUrl}`
            : message
          const result = await postToInstagram(business.metaIgAccountId!, pageToken, {
            imageUrl: post.content.image.storageUrl,
            caption,
          })
          platformPostId = result.id
        }

        // Success — update post
        await prisma.post.update({
          where: { id: post.id },
          data: {
            status: 'posted',
            platformPostId,
            postedAt: new Date(),
          },
        })

        // Update content status
        await prisma.content.update({
          where: { id: post.contentId },
          data: { status: 'posted' },
        })

        await logActivity(business.id, post.content.campaign.id, post.id, post.platform, 'post_cron_published', {
          platformPostId,
          contentHeadline: post.content.headline,
        })

        results.push({ postId: post.id, platform: post.platform, status: 'posted', platformPostId })
      } catch (err) {
        // Failure — update post and create escalation
        const errorMessage = err instanceof MetaError
          ? `Meta API Error (${err.code}): ${err.message}`
          : err instanceof Error
            ? err.message
            : 'Unknown posting error'

        await prisma.post.update({
          where: { id: post.id },
          data: { status: 'failed', errorMessage },
        })

        const severity = err instanceof MetaError ? getEscalationSeverity(err) : 'warning'
        const escalationType = err instanceof MetaError ? getEscalationType(err) : 'persistent_failure'

        await prisma.escalation.create({
          data: {
            campaignId: post.content.campaign.id,
            type: escalationType,
            severity,
            title: `Scheduled Post Failed: ${post.content.headline || 'Untitled'} on ${post.platform}`,
            description: errorMessage,
            status: 'open',
          },
        })

        await logActivity(business.id, post.content.campaign.id, post.id, post.platform, 'post_cron_failed', {
          error: errorMessage,
          contentHeadline: post.content.headline,
        })

        results.push({ postId: post.id, platform: post.platform, status: 'failed', error: errorMessage })
      }
    }

    return successResponse({
      processed: results.length,
      posted: results.filter((r) => r.status === 'posted').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to process scheduled posts')
  }
}

async function logActivity(
  businessId: string,
  campaignId: string,
  postId: string,
  platform: string,
  action: string,
  details: Record<string, unknown>
) {
  await prisma.activityLog.create({
    data: {
      businessId,
      campaignId,
      actor: 'system',
      action,
      entityType: 'post',
      entityId: postId,
      details: { platform, ...details } as Prisma.InputJsonValue,
    },
  })
}
