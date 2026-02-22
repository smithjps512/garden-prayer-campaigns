import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'

const PILLARS = ['time-back', 'bigger-paycheck', 'not-chatgpt']
const ARCHETYPES = [
  'pain-point', 'stat-proof', 'contrast', 'aspiration',
  'myth-buster', 'teacher-reality', 'individualization', 'outcome',
]

// GET /api/analytics/message-intelligence?businessId=X&campaignId=Y
export async function GET(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const campaignId = searchParams.get('campaignId')

    // Build where clause for content
    const contentWhere: Record<string, unknown> = {}
    if (campaignId) {
      contentWhere.campaignId = campaignId
    } else if (businessId) {
      contentWhere.campaign = {
        playbook: { businessId },
      }
    }

    // Get all scored content with their tags
    const scoredContent = await prisma.content.findMany({
      where: {
        ...contentWhere,
        performanceScore: { not: null },
      },
      select: {
        id: true,
        headline: true,
        body: true,
        pillar: true,
        archetype: true,
        audienceSegment: true,
        performanceScore: true,
        hookSource: true,
      },
    })

    // Get all content (including unscored) for untested combo detection
    const allContent = await prisma.content.findMany({
      where: contentWhere,
      select: {
        pillar: true,
        archetype: true,
        audienceSegment: true,
      },
    })

    // Collect unique audience segments from the data
    const audienceSet = new Set<string>()
    for (const c of allContent) {
      if (c.audienceSegment) audienceSet.add(c.audienceSegment)
    }
    const audiences = Array.from(audienceSet)

    // --- By Pillar ---
    const byPillar = PILLARS.map((pillar) => {
      const items = scoredContent.filter((c) => c.pillar === pillar)
      const avgScore = items.length > 0
        ? Math.round(items.reduce((sum, c) => sum + Number(c.performanceScore), 0) / items.length)
        : 0
      const topPerformer = items.sort((a, b) => Number(b.performanceScore) - Number(a.performanceScore))[0] || null
      return {
        pillar,
        avgScore,
        contentCount: items.length,
        topPerformer: topPerformer ? {
          id: topPerformer.id,
          headline: topPerformer.headline,
          score: Number(topPerformer.performanceScore),
        } : null,
      }
    })

    // --- By Archetype ---
    const byArchetype = ARCHETYPES.map((archetype) => {
      const items = scoredContent.filter((c) => c.archetype === archetype)
      const avgScore = items.length > 0
        ? Math.round(items.reduce((sum, c) => sum + Number(c.performanceScore), 0) / items.length)
        : 0
      const topPerformer = items.sort((a, b) => Number(b.performanceScore) - Number(a.performanceScore))[0] || null
      return {
        archetype,
        avgScore,
        contentCount: items.length,
        topPerformer: topPerformer ? {
          id: topPerformer.id,
          headline: topPerformer.headline,
          score: Number(topPerformer.performanceScore),
        } : null,
      }
    })

    // --- By Audience ---
    const byAudience = audiences.map((audience) => {
      const items = scoredContent.filter((c) => c.audienceSegment === audience)
      const avgScore = items.length > 0
        ? Math.round(items.reduce((sum, c) => sum + Number(c.performanceScore), 0) / items.length)
        : 0
      const topPerformer = items.sort((a, b) => Number(b.performanceScore) - Number(a.performanceScore))[0] || null
      return {
        audience,
        avgScore,
        contentCount: items.length,
        topPerformer: topPerformer ? {
          id: topPerformer.id,
          headline: topPerformer.headline,
          score: Number(topPerformer.performanceScore),
        } : null,
      }
    })

    // --- Combinations (pillar x archetype x audience) ---
    const combinationScores: Record<string, { scores: number[]; pillar: string; archetype: string; audience: string }> = {}

    for (const c of scoredContent) {
      if (c.pillar && c.archetype && c.audienceSegment) {
        const key = `${c.pillar}|${c.archetype}|${c.audienceSegment}`
        if (!combinationScores[key]) {
          combinationScores[key] = {
            scores: [],
            pillar: c.pillar,
            archetype: c.archetype,
            audience: c.audienceSegment,
          }
        }
        combinationScores[key].scores.push(Number(c.performanceScore))
      }
    }

    const rankedCombinations = Object.values(combinationScores)
      .map((combo) => ({
        pillar: combo.pillar,
        archetype: combo.archetype,
        audience: combo.audience,
        avgScore: Math.round(combo.scores.reduce((a, b) => a + b, 0) / combo.scores.length),
        contentCount: combo.scores.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)

    const topCombinations = rankedCombinations.slice(0, 5)
    const bottomCombinations = rankedCombinations.slice(-5).reverse()

    // --- Untested Combinations ---
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
          const key = `${pillar}|${archetype}|${audience}`
          if (!testedKeys.has(key)) {
            untestedCombinations.push({ pillar, archetype, audience })
          }
        }
      }
    }

    return successResponse({
      byPillar,
      byArchetype,
      byAudience,
      topCombinations,
      bottomCombinations,
      untestedCombinations: untestedCombinations.slice(0, 20), // Cap at 20
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    return serverErrorResponse(error, 'Failed to fetch message intelligence')
  }
}
