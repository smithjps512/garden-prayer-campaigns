import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'
import { Prisma } from '@prisma/client'
import {
  decryptToken,
  getPostInsights,
  getIgMediaInsights,
  MetaError,
} from '@/lib/meta'
import { scoreContent, autoRetireUnderperformers } from '@/lib/scoring'

/**
 * GET /api/cron/poll-metrics
 *
 * Vercel Cron Job — runs every 30 minutes.
 * Polls Meta API for engagement metrics on recently posted content
 * and upserts into the Performance model.
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

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Find posted posts from the last 30 days that have a platformPostId
    const posts = await prisma.post.findMany({
      where: {
        status: 'posted',
        postedAt: { gte: thirtyDaysAgo },
        platformPostId: { not: null },
      },
      include: {
        content: {
          select: {
            campaign: {
              select: {
                id: true,
                playbook: {
                  select: {
                    business: {
                      select: {
                        id: true,
                        metaPageToken: true,
                      },
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
          select: { id: true },
        },
      },
    })

    if (posts.length === 0) {
      return successResponse({ polled: 0, updated: 0, failed: 0, results: [] })
    }

    const results: Array<{
      postId: string
      platform: string
      status: 'updated' | 'failed'
      error?: string
    }> = []

    let retryDelay = 1000 // Start with 1s for rate limit backoff

    for (const post of posts) {
      const business = post.content.campaign.playbook.business

      if (!business.metaPageToken) {
        results.push({
          postId: post.id,
          platform: post.platform,
          status: 'failed',
          error: 'No Meta page token',
        })
        continue
      }

      let pageToken: string
      try {
        pageToken = decryptToken(business.metaPageToken)
      } catch {
        results.push({
          postId: post.id,
          platform: post.platform,
          status: 'failed',
          error: 'Failed to decrypt token',
        })
        continue
      }

      try {
        const insights = post.platform === 'instagram'
          ? await getIgMediaInsights(post.platformPostId!, pageToken)
          : await getPostInsights(post.platformPostId!, pageToken)

        const ctr = insights.impressions > 0
          ? insights.clicks / insights.impressions
          : 0

        const totalEngagement = insights.reactions + insights.comments + insights.shares
        const engagementRate = insights.impressions > 0
          ? totalEngagement / insights.impressions
          : 0

        // Upsert: update existing performance record or create new one
        const existingPerf = post.performances[0]
        if (existingPerf) {
          await prisma.performance.update({
            where: { id: existingPerf.id },
            data: {
              impressions: insights.impressions,
              reach: insights.reach,
              clicks: insights.clicks,
              likes: insights.reactions,
              comments: insights.comments,
              shares: insights.shares,
              ctr: new Prisma.Decimal(ctr.toFixed(4)),
              engagementRate: new Prisma.Decimal(engagementRate.toFixed(4)),
              recordedAt: new Date(),
            },
          })
        } else {
          await prisma.performance.create({
            data: {
              postId: post.id,
              impressions: insights.impressions,
              reach: insights.reach,
              clicks: insights.clicks,
              likes: insights.reactions,
              comments: insights.comments,
              shares: insights.shares,
              ctr: new Prisma.Decimal(ctr.toFixed(4)),
              engagementRate: new Prisma.Decimal(engagementRate.toFixed(4)),
            },
          })
        }

        results.push({ postId: post.id, platform: post.platform, status: 'updated' })

        // Reset backoff on success
        retryDelay = 1000
      } catch (err) {
        if (err instanceof MetaError && err.isRateLimited) {
          // Exponential backoff on rate limit
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
          retryDelay = Math.min(retryDelay * 2, 30000) // Max 30s
        }

        const errorMsg = err instanceof MetaError
          ? `Meta API Error (${err.code}): ${err.message}`
          : err instanceof Error
            ? err.message
            : 'Unknown error'

        results.push({
          postId: post.id,
          platform: post.platform,
          status: 'failed',
          error: errorMsg,
        })
      }
    }

    // Recalculate performance scores for affected content
    const updatedContentIds = new Set<string>()
    for (const post of posts) {
      const result = results.find((r) => r.postId === post.id)
      if (result?.status === 'updated') {
        updatedContentIds.add(post.contentId)
      }
    }

    let scored = 0
    for (const contentId of updatedContentIds) {
      try {
        await scoreContent(contentId)
        scored++
      } catch {
        // Non-critical: scoring failure shouldn't fail the cron
      }
    }

    // Auto-retire underperforming content (check affected campaigns)
    const affectedCampaignIds = new Set<string>()
    for (const post of posts) {
      if (updatedContentIds.has(post.contentId)) {
        affectedCampaignIds.add(post.content.campaign.id)
      }
    }

    let retired = 0
    for (const campaignId of affectedCampaignIds) {
      try {
        const result = await autoRetireUnderperformers(campaignId)
        retired += result.retired
      } catch {
        // Non-critical
      }
    }

    // Log activity summary
    const updated = results.filter((r) => r.status === 'updated').length
    const failed = results.filter((r) => r.status === 'failed').length

    if (results.length > 0) {
      await prisma.activityLog.create({
        data: {
          actor: 'system',
          action: 'metrics_polled',
          entityType: 'performance',
          details: {
            polled: posts.length,
            updated,
            failed,
            scored,
            retired,
          } as Prisma.InputJsonValue,
        },
      })
    }

    return successResponse({
      polled: posts.length,
      updated,
      failed,
      scored,
      retired,
      results,
    })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to poll metrics')
  }
}
