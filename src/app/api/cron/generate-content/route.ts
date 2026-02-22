import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'
import { generateContent, PlaybookContext, Hook, AudienceSegment } from '@/lib/claude'
import { Prisma } from '@prisma/client'

const PIPELINE_THRESHOLD = 10 // Minimum content pieces before triggering generation

const PILLARS = ['time-back', 'bigger-paycheck', 'not-chatgpt']
const ARCHETYPES = [
  'pain-point', 'stat-proof', 'contrast', 'aspiration',
  'myth-buster', 'teacher-reality', 'individualization', 'outcome',
]

/**
 * GET /api/cron/generate-content
 *
 * Vercel Cron Job — runs daily at 6 AM UTC.
 * For campaigns with autoMode != 'off', generates content to keep the pipeline full.
 * Enforces variety across pillars, archetypes, and audience segments.
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

    // Find active campaigns with autoMode enabled
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: { in: ['live', 'approved', 'setup'] },
        autoMode: { not: 'off' },
      },
      include: {
        playbook: {
          include: {
            business: true,
          },
        },
      },
    })

    if (campaigns.length === 0) {
      return successResponse({ campaignsProcessed: 0, contentGenerated: 0, postsScheduled: 0 })
    }

    let totalContentGenerated = 0
    let totalPostsScheduled = 0
    const campaignResults: Array<{
      campaignId: string
      name: string
      generated: number
      scheduled: number
    }> = []

    for (const campaign of campaigns) {
      const playbook = campaign.playbook
      if (!playbook?.positioning || !playbook.audiences || !playbook.hooks) {
        continue
      }

      // Count unposted content (generated or approved without a posted post)
      const pipelineCount = await prisma.content.count({
        where: {
          campaignId: campaign.id,
          status: { in: ['generated', 'approved'] },
          posts: {
            none: { status: 'posted' },
          },
        },
      })

      if (pipelineCount >= PIPELINE_THRESHOLD) {
        campaignResults.push({
          campaignId: campaign.id,
          name: campaign.name,
          generated: 0,
          scheduled: 0,
        })
        continue
      }

      const needed = PIPELINE_THRESHOLD - pipelineCount

      // --- Variety Enforcement ---
      // Query recent content to find underrepresented combinations
      const recentContent = await prisma.content.findMany({
        where: { campaignId: campaign.id },
        select: { pillar: true, archetype: true, audienceSegment: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })

      const pillarCounts: Record<string, number> = {}
      const archetypeCounts: Record<string, number> = {}
      const audienceCounts: Record<string, number> = {}

      for (const c of recentContent) {
        if (c.pillar) pillarCounts[c.pillar] = (pillarCounts[c.pillar] || 0) + 1
        if (c.archetype) archetypeCounts[c.archetype] = (archetypeCounts[c.archetype] || 0) + 1
        if (c.audienceSegment) audienceCounts[c.audienceSegment] = (audienceCounts[c.audienceSegment] || 0) + 1
      }

      // Find underrepresented pillars and archetypes
      const underrepPillars = PILLARS.filter((p) => (pillarCounts[p] || 0) < 3)
      const underrepArchetypes = ARCHETYPES.filter((a) => (archetypeCounts[a] || 0) < 2)

      const audiences = playbook.audiences as unknown as AudienceSegment[]
      const hooks = playbook.hooks as unknown as Hook[]
      const allAudienceNames = audiences.map((a) => a.name)
      const underrepAudiences = allAudienceNames.filter((a) => (audienceCounts[a] || 0) < 3)

      // Pick a target audience, preferring underrepresented ones
      const targetAudience = underrepAudiences.length > 0
        ? underrepAudiences[Math.floor(Math.random() * underrepAudiences.length)]
        : campaign.targetAudience || audiences[0].name

      // Build playbook context
      const playbookContext: PlaybookContext = {
        businessName: playbook.business.name,
        positioning: playbook.positioning,
        founderStory: playbook.founderStory || undefined,
        audiences,
        hooks,
        keyMessages: playbook.keyMessages as unknown as Record<string, string[]> | undefined,
        objectionHandlers: playbook.objectionHandlers as unknown as Record<string, string> | undefined,
      }

      // Generate content
      const count = Math.min(needed, 5) // Generate at most 5 at a time
      try {
        const result = await generateContent({
          playbook: playbookContext,
          targetAudience,
          hooks,
          contentType: 'organic_post',
          platform: 'both',
          count,
        })

        let generated = 0
        let scheduled = 0

        for (const variation of result.variations) {
          const status = campaign.autoMode === 'generate-and-post' ? 'approved' : 'generated'

          const content = await prisma.content.create({
            data: {
              campaignId: campaign.id,
              type: 'organic_post',
              status,
              headline: variation.headline,
              body: variation.body,
              ctaText: variation.ctaText,
              hookSource: variation.hookSource,
              audienceSegment: variation.audienceSegment,
              pillar: variation.pillar || (underrepPillars.length > 0
                ? underrepPillars[generated % underrepPillars.length]
                : null),
              archetype: variation.archetype || (underrepArchetypes.length > 0
                ? underrepArchetypes[generated % underrepArchetypes.length]
                : null),
              platformVariants: {
                [variation.platform]: {
                  headline: variation.headline,
                  body: variation.body,
                  ctaText: variation.ctaText,
                },
              } as Prisma.InputJsonValue,
              generationMetadata: {
                model: result.metadata.model,
                generatedAt: result.metadata.generatedAt,
                reasoning: variation.reasoning,
                autoGenerated: true,
              } as Prisma.InputJsonValue,
            },
          })

          generated++

          // Auto-schedule for generate-and-post mode
          if (campaign.autoMode === 'generate-and-post') {
            const scheduledFor = getNextScheduleSlot(campaign.id, scheduled)

            await prisma.post.create({
              data: {
                contentId: content.id,
                platform: variation.platform === 'instagram' ? 'instagram' : 'facebook',
                status: 'scheduled',
                scheduledFor,
              },
            })

            scheduled++
          }
        }

        totalContentGenerated += generated
        totalPostsScheduled += scheduled

        campaignResults.push({
          campaignId: campaign.id,
          name: campaign.name,
          generated,
          scheduled,
        })
      } catch (err) {
        console.error(`Failed to generate content for campaign ${campaign.id}:`, err)
        campaignResults.push({
          campaignId: campaign.id,
          name: campaign.name,
          generated: 0,
          scheduled: 0,
        })
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        actor: 'system',
        action: 'content_auto_generated',
        entityType: 'content',
        details: {
          campaignsProcessed: campaigns.length,
          contentGenerated: totalContentGenerated,
          postsScheduled: totalPostsScheduled,
          results: campaignResults,
        } as Prisma.InputJsonValue,
      },
    })

    return successResponse({
      campaignsProcessed: campaigns.length,
      contentGenerated: totalContentGenerated,
      postsScheduled: totalPostsScheduled,
      results: campaignResults,
    })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to generate content')
  }
}

/**
 * Calculate the next available schedule slot.
 * Default cadence: 2 posts/day, spread at 9 AM and 2 PM UTC.
 * Offsets by day based on the slot index to spread over multiple days.
 */
function getNextScheduleSlot(campaignId: string, slotIndex: number): Date {
  const now = new Date()
  const dayOffset = Math.floor(slotIndex / 2) + 1 // Start tomorrow
  const hour = slotIndex % 2 === 0 ? 14 : 19 // 9 AM and 2 PM EST (14 and 19 UTC)

  const scheduled = new Date(now)
  scheduled.setDate(scheduled.getDate() + dayOffset)
  scheduled.setHours(hour, 0, 0, 0)

  // Add a small hash-based offset to avoid exact same times for different campaigns
  const hash = campaignId.charCodeAt(0) % 30
  scheduled.setMinutes(hash)

  return scheduled
}
