import prisma from './prisma'
import { Prisma } from '@prisma/client'

// =============================================================================
// Weight Presets
// =============================================================================

export interface WeightPreset {
  conversions: number
  ctr: number
  engagementRate: number
  impressions: number
  reach: number
}

export const WEIGHT_PRESETS: Record<string, WeightPreset> = {
  conversion: {
    conversions: 0.40,
    ctr: 0.25,
    engagementRate: 0.20,
    impressions: 0.10,
    reach: 0.05,
  },
  awareness: {
    conversions: 0.10,
    ctr: 0.15,
    engagementRate: 0.20,
    impressions: 0.35,
    reach: 0.20,
  },
  engagement: {
    conversions: 0.10,
    ctr: 0.20,
    engagementRate: 0.40,
    impressions: 0.15,
    reach: 0.15,
  },
}

// =============================================================================
// Score Calculation
// =============================================================================

export interface MetricsInput {
  impressions: number
  reach: number
  clicks: number
  conversions: number
  engagementRate: number
  ctr: number
}

/**
 * Calculate a normalized performance score (0-100) from raw metrics.
 *
 * Each metric is normalized against benchmark values, then weighted
 * according to the preset. The result is clamped to 0-100.
 */
export function calculatePerformanceScore(
  metrics: MetricsInput,
  weights: WeightPreset = WEIGHT_PRESETS.conversion
): number {
  // Benchmark values for normalization (social media industry averages)
  const benchmarks = {
    impressions: 1000,   // 1K impressions = baseline
    reach: 800,          // 800 reach = baseline
    ctr: 0.02,           // 2% CTR = baseline
    engagementRate: 0.03, // 3% engagement = baseline
    conversions: 5,      // 5 conversions = baseline
  }

  // Normalize each metric as a ratio to benchmark (capped at 2x for outlier control)
  const normalizedImpressions = Math.min(metrics.impressions / benchmarks.impressions, 2)
  const normalizedReach = Math.min(metrics.reach / benchmarks.reach, 2)
  const normalizedCtr = Math.min(metrics.ctr / benchmarks.ctr, 2)
  const normalizedEngagement = Math.min(metrics.engagementRate / benchmarks.engagementRate, 2)
  const normalizedConversions = Math.min(metrics.conversions / benchmarks.conversions, 2)

  // Weighted composite (each normalized value is 0-2, so max raw = 2)
  const rawScore =
    normalizedConversions * weights.conversions +
    normalizedCtr * weights.ctr +
    normalizedEngagement * weights.engagementRate +
    normalizedImpressions * weights.impressions +
    normalizedReach * weights.reach

  // Scale to 0-100 (rawScore max = 2.0 when all metrics are at 2x benchmark)
  const score = Math.round(Math.min(rawScore * 50, 100))

  return score
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Score a single content piece by aggregating performance data from all its posts.
 * Returns the calculated score.
 */
export async function scoreContent(contentId: string): Promise<number> {
  // Get all performance records linked to posts for this content
  const performances = await prisma.performance.findMany({
    where: {
      post: { contentId },
    },
    select: {
      impressions: true,
      reach: true,
      clicks: true,
      ctr: true,
      engagementRate: true,
      signups: true,
      trials: true,
      purchases: true,
    },
  })

  if (performances.length === 0) {
    return 0
  }

  // Aggregate metrics across all posts
  let totalImpressions = 0
  let totalReach = 0
  let totalClicks = 0
  let totalConversions = 0

  for (const perf of performances) {
    totalImpressions += perf.impressions
    totalReach += perf.reach
    totalClicks += perf.clicks
    totalConversions += perf.signups + perf.trials + perf.purchases
  }

  const aggregatedCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0
  const totalEngagement = performances.reduce((sum, p) => {
    const rate = p.engagementRate ? Number(p.engagementRate) : 0
    return sum + rate
  }, 0)
  const avgEngagementRate = totalEngagement / performances.length

  const score = calculatePerformanceScore({
    impressions: totalImpressions,
    reach: totalReach,
    clicks: totalClicks,
    conversions: totalConversions,
    ctr: aggregatedCtr,
    engagementRate: avgEngagementRate,
  })

  // Update the content record
  await prisma.content.update({
    where: { id: contentId },
    data: {
      performanceScore: new Prisma.Decimal(score),
      scoredAt: new Date(),
    },
  })

  return score
}

/**
 * Score all content pieces for a campaign.
 * Returns count of scored and skipped items.
 */
export async function scoreAllForCampaign(
  campaignId: string
): Promise<{ scored: number; skipped: number }> {
  // Get all content for this campaign that has at least one posted post with performance data
  const contents = await prisma.content.findMany({
    where: { campaignId },
    select: {
      id: true,
      posts: {
        where: { status: 'posted' },
        select: {
          performances: {
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  })

  let scored = 0
  let skipped = 0

  for (const content of contents) {
    const hasPerformance = content.posts.some((p) => p.performances.length > 0)

    if (hasPerformance) {
      await scoreContent(content.id)
      scored++
    } else {
      skipped++
    }
  }

  return { scored, skipped }
}

// =============================================================================
// Auto-Retire Underperformers
// =============================================================================

const DEFAULT_MIN_IMPRESSIONS = 500

/**
 * Auto-retire underperforming content for a given set of content IDs.
 * Retires content in the bottom 20th percentile that has sufficient impressions.
 * Returns count of retired content.
 */
export async function autoRetireUnderperformers(
  campaignId: string
): Promise<{ retired: number }> {
  // Get all scored, non-retired content for this campaign
  const scoredContent = await prisma.content.findMany({
    where: {
      campaignId,
      performanceScore: { not: null },
      status: { notIn: ['retired', 'paused'] },
    },
    select: {
      id: true,
      headline: true,
      performanceScore: true,
      posts: {
        select: {
          performances: {
            select: { impressions: true },
          },
        },
      },
    },
  })

  if (scoredContent.length < 5) {
    // Not enough data to meaningfully determine a percentile
    return { retired: 0 }
  }

  // Calculate total impressions per content
  const contentWithImpressions = scoredContent.map((c) => {
    const totalImpressions = c.posts.reduce((sum, p) =>
      sum + p.performances.reduce((s, perf) => s + perf.impressions, 0), 0)
    return {
      id: c.id,
      headline: c.headline,
      score: Number(c.performanceScore),
      impressions: totalImpressions,
    }
  })

  // Only consider content with enough impressions
  const eligible = contentWithImpressions.filter((c) => c.impressions >= DEFAULT_MIN_IMPRESSIONS)

  if (eligible.length < 5) {
    return { retired: 0 }
  }

  // Calculate 20th percentile threshold
  const scores = eligible.map((c) => c.score).sort((a, b) => a - b)
  const percentileIndex = Math.floor(scores.length * 0.2)
  const threshold = scores[percentileIndex]

  // Find content below threshold
  const toRetire = eligible.filter((c) => c.score <= threshold)

  let retired = 0
  for (const content of toRetire) {
    await prisma.content.update({
      where: { id: content.id },
      data: { status: 'retired' },
    })

    // Create an escalation for visibility
    await prisma.escalation.create({
      data: {
        campaignId,
        type: 'below_threshold',
        severity: 'info',
        title: `Auto-retired: ${content.headline || 'Untitled content'}`,
        description: `Content auto-retired due to low performance score (${content.score}/100) after ${content.impressions} impressions. Threshold: ${threshold}/100 (bottom 20th percentile).`,
        status: 'open',
        aiAnalysis: `Performance score ${content.score} is in the bottom 20th percentile of scored content for this campaign.`,
        aiRecommendation: 'Consider generating new content variations targeting this audience segment with different angles.',
      },
    })

    retired++
  }

  return { retired }
}
