import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'

// GET /api/analytics/time-series?range=30&campaignId=X&groupBy=daily
export async function GET(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const { searchParams } = new URL(request.url)
    const range = parseInt(searchParams.get('range') || '30', 10) // days
    const campaignId = searchParams.get('campaignId')
    const groupBy = searchParams.get('groupBy') || 'daily' // daily or weekly

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - range)

    // Get all performance records within the date range
    const performanceWhere: Record<string, unknown> = {
      recordedAt: { gte: startDate },
    }
    if (campaignId) {
      performanceWhere.post = { content: { campaignId } }
    }

    const performances = await prisma.performance.findMany({
      where: performanceWhere,
      select: {
        impressions: true,
        reach: true,
        clicks: true,
        likes: true,
        comments: true,
        shares: true,
        ctr: true,
        engagementRate: true,
        signups: true,
        trials: true,
        purchases: true,
        recordedAt: true,
        post: {
          select: {
            content: {
              select: {
                pillar: true,
                archetype: true,
                audienceSegment: true,
                performanceScore: true,
              },
            },
          },
        },
      },
      orderBy: { recordedAt: 'asc' },
    })

    // Group by date
    const dateGroups: Record<string, {
      impressions: number
      clicks: number
      conversions: number
      ctr: number[]
      engagementRate: number[]
      pillarScores: Record<string, number[]>
      audienceScores: Record<string, number[]>
    }> = {}

    for (const perf of performances) {
      const date = perf.recordedAt
      let key: string

      if (groupBy === 'weekly') {
        // Week start (Monday)
        const d = new Date(date)
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        d.setDate(diff)
        key = d.toISOString().split('T')[0]
      } else {
        key = date.toISOString().split('T')[0]
      }

      if (!dateGroups[key]) {
        dateGroups[key] = {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: [],
          engagementRate: [],
          pillarScores: {},
          audienceScores: {},
        }
      }

      const group = dateGroups[key]
      group.impressions += perf.impressions
      group.clicks += perf.clicks
      group.conversions += perf.signups + perf.trials + perf.purchases
      if (perf.ctr) group.ctr.push(Number(perf.ctr))
      if (perf.engagementRate) group.engagementRate.push(Number(perf.engagementRate))

      // Pillar and audience scores
      const content = perf.post.content
      if (content.pillar && content.performanceScore) {
        const score = Number(content.performanceScore)
        if (!group.pillarScores[content.pillar]) group.pillarScores[content.pillar] = []
        group.pillarScores[content.pillar].push(score)
      }
      if (content.audienceSegment && content.performanceScore) {
        const score = Number(content.performanceScore)
        if (!group.audienceScores[content.audienceSegment]) group.audienceScores[content.audienceSegment] = []
        group.audienceScores[content.audienceSegment].push(score)
      }
    }

    // Build time-series arrays
    const metrics = Object.entries(dateGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, group]) => ({
        date,
        impressions: group.impressions,
        clicks: group.clicks,
        conversions: group.conversions,
        ctr: group.ctr.length > 0
          ? Number((group.ctr.reduce((a, b) => a + b, 0) / group.ctr.length * 100).toFixed(2))
          : 0,
        engagementRate: group.engagementRate.length > 0
          ? Number((group.engagementRate.reduce((a, b) => a + b, 0) / group.engagementRate.length * 100).toFixed(2))
          : 0,
      }))

    // Pillar trends
    const allPillars = new Set<string>()
    for (const group of Object.values(dateGroups)) {
      for (const p of Object.keys(group.pillarScores)) allPillars.add(p)
    }

    const pillarTrends = Object.entries(dateGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, group]) => {
        const entry: Record<string, unknown> = { date }
        for (const pillar of allPillars) {
          const scores = group.pillarScores[pillar]
          entry[pillar] = scores && scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null
        }
        return entry
      })

    // Audience trends
    const allAudiences = new Set<string>()
    for (const group of Object.values(dateGroups)) {
      for (const a of Object.keys(group.audienceScores)) allAudiences.add(a)
    }

    const audienceTrends = Object.entries(dateGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, group]) => {
        const entry: Record<string, unknown> = { date }
        for (const audience of allAudiences) {
          const scores = group.audienceScores[audience]
          entry[audience] = scores && scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null
        }
        return entry
      })

    // Content funnel data
    const contentWhere = campaignId ? { campaignId } : {}
    const funnelData = await prisma.content.groupBy({
      by: ['status'],
      where: contentWhere,
      _count: true,
    })

    const funnel = {
      generated: 0,
      approved: 0,
      posted: 0,
      retired: 0,
    }
    for (const row of funnelData) {
      if (row.status in funnel) {
        funnel[row.status as keyof typeof funnel] = row._count
      }
    }

    // Add click/conversion totals from performance data
    const clicksTotal = performances.reduce((sum, p) => sum + p.clicks, 0)
    const conversionsTotal = performances.reduce(
      (sum, p) => sum + p.signups + p.trials + p.purchases,
      0
    )

    return successResponse({
      metrics,
      pillarTrends,
      audienceTrends,
      pillars: Array.from(allPillars),
      audiences: Array.from(allAudiences),
      funnel: {
        ...funnel,
        clicked: clicksTotal,
        converted: conversionsTotal,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    return serverErrorResponse(error, 'Failed to fetch time-series data')
  }
}
