import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, serverErrorResponse } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'

// GET /api/analytics - Aggregate performance data
export async function GET(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')

    // Aggregate performance metrics
    const performanceWhere = campaignId
      ? { post: { content: { campaignId } } }
      : {}

    const performance = await prisma.performance.aggregate({
      where: performanceWhere,
      _sum: {
        impressions: true,
        reach: true,
        clicks: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
        landingViews: true,
        signups: true,
        trials: true,
        purchases: true,
        spend: true,
        revenue: true,
      },
      _count: true,
    })

    // Conversion counts
    const conversionWhere = campaignId ? { campaignId } : {}
    const conversions = await prisma.conversion.aggregate({
      where: conversionWhere,
      _count: true,
      _sum: {
        value: true,
      },
    })

    // Per-campaign breakdown
    const campaigns = await prisma.campaign.findMany({
      where: campaignId ? { id: campaignId } : { status: { in: ['live', 'paused', 'completed'] } },
      select: {
        id: true,
        name: true,
        status: true,
        budgetTotal: true,
        budgetDaily: true,
        contents: {
          select: {
            id: true,
            posts: {
              select: {
                id: true,
                platform: true,
                budgetSpent: true,
                performances: {
                  select: {
                    impressions: true,
                    clicks: true,
                    likes: true,
                    comments: true,
                    shares: true,
                    spend: true,
                    revenue: true,
                    ctr: true,
                    roas: true,
                  },
                  orderBy: { recordedAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        _count: {
          select: {
            contents: true,
            conversions: true,
          },
        },
      },
    })

    // Build per-campaign aggregations
    const campaignBreakdown = campaigns.map((campaign) => {
      let totalImpressions = 0
      let totalClicks = 0
      let totalLikes = 0
      let totalComments = 0
      let totalShares = 0
      let totalSpend = 0
      let totalRevenue = 0

      let postCount = 0
      campaign.contents.forEach((content) => {
        content.posts.forEach((post) => {
          postCount++
          if (post.performances.length > 0) {
            const perf = post.performances[0]
            totalImpressions += perf.impressions
            totalClicks += perf.clicks
            totalLikes += perf.likes
            totalComments += perf.comments
            totalShares += perf.shares
            totalSpend += Number(perf.spend)
            totalRevenue += Number(perf.revenue)
          }
          totalSpend += Number(post.budgetSpent)
        })
      })

      const ctr = totalImpressions > 0
        ? ((totalClicks / totalImpressions) * 100).toFixed(2)
        : '0.00'

      const roas = totalSpend > 0
        ? (totalRevenue / totalSpend).toFixed(2)
        : '0.00'

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        contentCount: campaign._count.contents,
        postCount,
        conversionCount: campaign._count.conversions,
        impressions: totalImpressions,
        clicks: totalClicks,
        engagement: totalLikes + totalComments + totalShares,
        spend: totalSpend.toFixed(2),
        revenue: totalRevenue.toFixed(2),
        ctr,
        roas,
      }
    })

    // Overall stats
    const sum = performance._sum
    const totalImpressions = sum.impressions || 0
    const totalClicks = sum.clicks || 0
    const totalSpend = Number(sum.spend || 0)
    const totalRevenue = Number(sum.revenue || 0)

    const overview = {
      impressions: totalImpressions,
      reach: sum.reach || 0,
      clicks: totalClicks,
      likes: sum.likes || 0,
      comments: sum.comments || 0,
      shares: sum.shares || 0,
      saves: sum.saves || 0,
      conversions: conversions._count,
      conversionValue: Number(conversions._sum.value || 0).toFixed(2),
      spend: totalSpend.toFixed(2),
      revenue: totalRevenue.toFixed(2),
      ctr: totalImpressions > 0
        ? ((totalClicks / totalImpressions) * 100).toFixed(2)
        : '0.00',
      roas: totalSpend > 0
        ? (totalRevenue / totalSpend).toFixed(2)
        : '0.00',
      signups: sum.signups || 0,
      trials: sum.trials || 0,
      purchases: sum.purchases || 0,
    }

    // Content and post counts
    const contentCount = await prisma.content.count(
      campaignId ? { where: { campaignId } } : undefined
    )
    const postCount = await prisma.post.count(
      campaignId ? { where: { content: { campaignId } } } : undefined
    )

    // Last metrics update timestamp
    const lastMetricsPoll = await prisma.performance.findFirst({
      orderBy: { recordedAt: 'desc' },
      select: { recordedAt: true },
      where: performanceWhere,
    })

    // Post-level performance drill-down (top 20 posts by most recent)
    const postPerformance = await prisma.post.findMany({
      where: {
        status: 'posted',
        ...(campaignId ? { content: { campaignId } } : {}),
      },
      select: {
        id: true,
        platform: true,
        platformPostId: true,
        postedAt: true,
        content: {
          select: {
            headline: true,
            campaign: { select: { name: true } },
          },
        },
        performances: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
          select: {
            impressions: true,
            reach: true,
            clicks: true,
            likes: true,
            comments: true,
            shares: true,
            ctr: true,
            engagementRate: true,
            recordedAt: true,
          },
        },
      },
      orderBy: { postedAt: 'desc' },
      take: 20,
    })

    const postBreakdown = postPerformance.map((post) => {
      const perf = post.performances[0]
      return {
        id: post.id,
        platform: post.platform,
        platformPostId: post.platformPostId,
        postedAt: post.postedAt,
        headline: post.content.headline,
        campaignName: post.content.campaign.name,
        impressions: perf?.impressions ?? 0,
        reach: perf?.reach ?? 0,
        clicks: perf?.clicks ?? 0,
        likes: perf?.likes ?? 0,
        comments: perf?.comments ?? 0,
        shares: perf?.shares ?? 0,
        ctr: perf?.ctr ? Number(perf.ctr).toFixed(4) : '0.0000',
        engagementRate: perf?.engagementRate ? Number(perf.engagementRate).toFixed(4) : '0.0000',
        lastUpdated: perf?.recordedAt || null,
      }
    })

    return successResponse({
      overview,
      campaigns: campaignBreakdown,
      posts: postBreakdown,
      counts: {
        content: contentCount,
        posts: postCount,
        performanceRecords: performance._count,
      },
      lastUpdated: lastMetricsPoll?.recordedAt || null,
    })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch analytics')
  }
}
