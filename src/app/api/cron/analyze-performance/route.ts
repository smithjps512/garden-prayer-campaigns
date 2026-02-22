import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'
import { generateRecommendations, RecommendationInput } from '@/lib/claude'
import { Prisma } from '@prisma/client'

const PILLARS = ['time-back', 'bigger-paycheck', 'not-chatgpt']
const ARCHETYPES = [
  'pain-point', 'stat-proof', 'contrast', 'aspiration',
  'myth-buster', 'teacher-reality', 'individualization', 'outcome',
]

/**
 * GET /api/cron/analyze-performance
 *
 * Vercel Cron Job — runs weekly on Monday at 8 AM UTC.
 * Gathers message intelligence data and uses Claude to generate
 * actionable recommendations (amplify, retire, test, iterate).
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

    // Find businesses with active campaigns
    const businesses = await prisma.business.findMany({
      where: {
        playbooks: {
          some: {
            campaigns: {
              some: {
                status: { in: ['live', 'paused', 'completed'] },
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        playbooks: {
          select: {
            campaigns: {
              where: { status: { in: ['live', 'paused', 'completed'] } },
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    let totalRecommendations = 0
    const businessResults: Array<{
      businessId: string
      name: string
      recommendations: number
    }> = []

    for (const business of businesses) {
      const campaignIds = business.playbooks.flatMap((p) => p.campaigns.map((c) => c.id))

      if (campaignIds.length === 0) continue

      // Gather scored content
      const scoredContent = await prisma.content.findMany({
        where: {
          campaignId: { in: campaignIds },
          performanceScore: { not: null },
        },
        select: {
          id: true,
          pillar: true,
          archetype: true,
          audienceSegment: true,
          performanceScore: true,
          campaignId: true,
        },
      })

      // Gather all content for untested detection
      const allContent = await prisma.content.findMany({
        where: { campaignId: { in: campaignIds } },
        select: {
          pillar: true,
          archetype: true,
          audienceSegment: true,
        },
      })

      // Collect audiences
      const audienceSet = new Set<string>()
      for (const c of allContent) {
        if (c.audienceSegment) audienceSet.add(c.audienceSegment)
      }
      const audiences = Array.from(audienceSet)

      // Build message matrix
      const byPillar = PILLARS.map((pillar) => {
        const items = scoredContent.filter((c) => c.pillar === pillar)
        const avgScore = items.length > 0
          ? Math.round(items.reduce((sum, c) => sum + Number(c.performanceScore), 0) / items.length)
          : 0
        return { pillar, avgScore, contentCount: items.length }
      })

      const byArchetype = ARCHETYPES.map((archetype) => {
        const items = scoredContent.filter((c) => c.archetype === archetype)
        const avgScore = items.length > 0
          ? Math.round(items.reduce((sum, c) => sum + Number(c.performanceScore), 0) / items.length)
          : 0
        return { archetype, avgScore, contentCount: items.length }
      })

      const byAudience = audiences.map((audience) => {
        const items = scoredContent.filter((c) => c.audienceSegment === audience)
        const avgScore = items.length > 0
          ? Math.round(items.reduce((sum, c) => sum + Number(c.performanceScore), 0) / items.length)
          : 0
        return { audience, avgScore, contentCount: items.length }
      })

      // Combinations
      const combos: Record<string, { scores: number[]; pillar: string; archetype: string; audience: string }> = {}
      for (const c of scoredContent) {
        if (c.pillar && c.archetype && c.audienceSegment) {
          const key = `${c.pillar}|${c.archetype}|${c.audienceSegment}`
          if (!combos[key]) {
            combos[key] = { scores: [], pillar: c.pillar, archetype: c.archetype, audience: c.audienceSegment }
          }
          combos[key].scores.push(Number(c.performanceScore))
        }
      }

      const ranked = Object.values(combos)
        .map((c) => ({
          pillar: c.pillar,
          archetype: c.archetype,
          audience: c.audience,
          avgScore: Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length),
        }))
        .sort((a, b) => b.avgScore - a.avgScore)

      const topCombinations = ranked.slice(0, 5)
      const bottomCombinations = ranked.slice(-5).reverse()

      // Untested combos
      const testedKeys = new Set<string>()
      for (const c of allContent) {
        if (c.pillar && c.archetype && c.audienceSegment) {
          testedKeys.add(`${c.pillar}|${c.archetype}|${c.audienceSegment}`)
        }
      }

      const untestedCombinations: Array<{ pillar: string; archetype: string; audience: string }> = []
      for (const pillar of PILLARS) {
        for (const archetype of ARCHETYPES) {
          for (const audience of audiences) {
            if (!testedKeys.has(`${pillar}|${archetype}|${audience}`)) {
              untestedCombinations.push({ pillar, archetype, audience })
            }
          }
        }
      }

      // Recent generation history
      const recentGeneration = await prisma.content.findMany({
        where: { campaignId: { in: campaignIds } },
        select: { pillar: true, archetype: true, audienceSegment: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })

      const recentHistory = recentGeneration.map((c) => ({
        pillar: c.pillar || 'unknown',
        archetype: c.archetype || 'unknown',
        audience: c.audienceSegment || 'unknown',
        createdAt: c.createdAt.toISOString(),
      }))

      // Skip if not enough data
      if (scoredContent.length < 3) {
        businessResults.push({ businessId: business.id, name: business.name, recommendations: 0 })
        continue
      }

      // Call Claude for recommendations
      const input: RecommendationInput = {
        businessName: business.name,
        messageMatrix: {
          byPillar,
          byArchetype,
          byAudience,
          topCombinations,
          bottomCombinations,
          untestedCombinations: untestedCombinations.slice(0, 15),
        },
        recentGenerationHistory: recentHistory,
      }

      try {
        const recs = await generateRecommendations(input)

        // Store recommendations for each active campaign
        for (const cId of campaignIds) {
          const allRecs = [
            ...recs.amplify.map((r) => ({
              type: 'amplify' as const,
              title: r.title,
              reasoning: r.reasoning,
              actionData: { pillar: r.pillar, archetype: r.archetype, audience: r.audience },
            })),
            ...recs.retire.map((r) => ({
              type: 'retire' as const,
              title: r.title,
              reasoning: r.reasoning,
              actionData: { contentIds: r.contentIds },
            })),
            ...recs.test.map((r) => ({
              type: 'test' as const,
              title: r.title,
              reasoning: r.reasoning,
              actionData: { pillar: r.pillar, archetype: r.archetype, audience: r.audience },
            })),
            ...recs.iterate.map((r) => ({
              type: 'iterate' as const,
              title: r.title,
              reasoning: r.reasoning,
              actionData: { pillar: r.pillar, archetype: r.archetype, audience: r.audience, winningAngle: r.winningAngle },
            })),
          ]

          for (const rec of allRecs) {
            await prisma.recommendation.create({
              data: {
                campaignId: cId,
                type: rec.type,
                title: rec.title,
                reasoning: rec.reasoning,
                actionData: rec.actionData as Prisma.InputJsonValue,
                status: 'pending',
              },
            })
            totalRecommendations++
          }
        }

        businessResults.push({
          businessId: business.id,
          name: business.name,
          recommendations: totalRecommendations,
        })
      } catch (err) {
        console.error(`Failed to generate recommendations for ${business.name}:`, err)
        businessResults.push({ businessId: business.id, name: business.name, recommendations: 0 })
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        actor: 'system',
        action: 'performance_analyzed',
        entityType: 'recommendation',
        details: {
          businessesProcessed: businesses.length,
          totalRecommendations,
          results: businessResults,
        } as Prisma.InputJsonValue,
      },
    })

    return successResponse({
      businessesProcessed: businesses.length,
      totalRecommendations,
      results: businessResults,
    })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to analyze performance')
  }
}
