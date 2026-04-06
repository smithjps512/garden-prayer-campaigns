import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'
import { Prisma } from '@prisma/client'
import {
  decryptToken,
  postToFacebook,
  postToInstagram,
  MetaError,
  InstagramPublishError,
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
                        websiteUrl: true,
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

      // Build UTM-tagged link. If content has a ctaUrl, use it. Otherwise fall back
      // to the business website so every post has a trackable link.
      const storedUtm = post.targeting as unknown as UTMParams | null
      const baseUrl = post.content.ctaUrl || business.websiteUrl || undefined
      const ctaUrl = baseUrl && storedUtm
        ? appendUTMToUrl(baseUrl, storedUtm)
        : baseUrl || undefined

      // Append UTM link to message body so it appears in the post copy.
      // This ensures conversion tracking even when Meta doesn't show the link param.
      if (ctaUrl) {
        messageParts.push(ctaUrl)
      }

      let message = messageParts.join('\n\n')

      // Enforce platform character limits after appending link
      const FACEBOOK_CHAR_LIMIT = 63206
      const INSTAGRAM_CHAR_LIMIT = 2200
      if (post.platform === 'instagram' && message.length > INSTAGRAM_CHAR_LIMIT) {
        message = message.slice(0, INSTAGRAM_CHAR_LIMIT)
      } else if (post.platform === 'facebook' && message.length > FACEBOOK_CHAR_LIMIT) {
        message = message.slice(0, FACEBOOK_CHAR_LIMIT)
      }

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
      // IMAGE ATTACHMENT: When Content.imageId is set, the image is included in content.image
      // via the Prisma include above. For Facebook, postToFacebook uses /{page-id}/photos
      // when imageUrl is present (photo post) and /{page-id}/feed when absent (text/link post).
      // For Instagram, postToInstagram always requires an image (IG container creation needs image_url).
      // Image URLs are Supabase Storage public URLs — used directly for Meta API calls.
      try {
        let platformPostId: string

        if (post.platform === 'facebook') {
          if (post.content.image?.storageUrl) {
            console.log(`[process-posts] Facebook photo post with image: ${post.content.image.storageUrl}`)
          }
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
          // UTM link is already appended to message above — use message directly as caption
          const result = await postToInstagram(business.metaIgAccountId!, pageToken, {
            imageUrl: post.content.image.storageUrl,
            caption: message,
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
          : err instanceof InstagramPublishError
            ? `Instagram Publish Error (${err.statusCode}): ${err.message}`
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
