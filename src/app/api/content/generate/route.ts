import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { generateContent, PlaybookContext, Hook, AudienceSegment, findAudienceSegment, parseTargetAudiences } from '@/lib/claude'
import { Prisma } from '@prisma/client'

// POST /api/content/generate - Generate content batch for campaign
export async function POST(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const body = await parseBody<{
      campaignId: string
      count?: number
      contentType?: 'ad' | 'organic_post' | 'story'
      platform?: 'facebook' | 'instagram' | 'both'
      hookIds?: string[] // Specific hooks to use (optional)
    }>(request)

    if (!body.campaignId) {
      return errorResponse('Campaign ID is required', 400)
    }

    // Get campaign with playbook
    const campaign = await prisma.campaign.findUnique({
      where: { id: body.campaignId },
      include: {
        playbook: {
          include: {
            business: true,
          },
        },
      },
    })

    if (!campaign) {
      return errorResponse('Campaign not found', 404)
    }

    if (!campaign.playbook) {
      return errorResponse('Campaign has no associated playbook', 400)
    }

    const playbook = campaign.playbook

    // Validate playbook has required data
    if (!playbook.positioning) {
      return errorResponse('Playbook must have positioning defined', 400)
    }

    if (!playbook.hooks || !Array.isArray(playbook.hooks) || playbook.hooks.length === 0) {
      return errorResponse('Playbook must have hooks defined', 400)
    }

    if (!playbook.audiences || !Array.isArray(playbook.audiences) || playbook.audiences.length === 0) {
      return errorResponse('Playbook must have audiences defined', 400)
    }

    // Build playbook context
    const playbookContext: PlaybookContext = {
      businessName: playbook.business.name,
      positioning: playbook.positioning,
      founderStory: playbook.founderStory || undefined,
      audiences: playbook.audiences as unknown as AudienceSegment[],
      hooks: playbook.hooks as unknown as Hook[],
      keyMessages: playbook.keyMessages as unknown as Record<string, string[]> | undefined,
      objectionHandlers: playbook.objectionHandlers as unknown as Record<string, string> | undefined,
    }

    // Select hooks to use
    let hooks = playbookContext.hooks
    if (body.hookIds && body.hookIds.length > 0) {
      hooks = hooks.filter((h) => body.hookIds!.includes(h.id))
      if (hooks.length === 0) {
        return errorResponse('No valid hooks found matching provided IDs', 400)
      }
    }

    // Determine target audiences from campaign or use first audience
    const rawAudience = campaign.targetAudience || playbookContext.audiences[0].name
    const audienceNames = parseTargetAudiences(rawAudience)
    const availableNames = playbookContext.audiences.map((a) => a.name)

    // Validate all audience segments exist (case-insensitive)
    for (const name of audienceNames) {
      if (!findAudienceSegment(playbookContext.audiences, name)) {
        return errorResponse(
          `Audience segment "${name}" not found. Available segments: ${availableNames.join(', ')}`,
          400
        )
      }
    }

    // Generate content for each audience segment, distributing count across them
    const countPerAudience = Math.max(1, Math.floor((body.count || 5) / audienceNames.length))
    const allVariations: Array<{
      variations: Awaited<ReturnType<typeof generateContent>>['variations']
      metadata: Awaited<ReturnType<typeof generateContent>>['metadata']
    }> = []

    for (const audienceName of audienceNames) {
      const matched = findAudienceSegment(playbookContext.audiences, audienceName)!
      const result = await generateContent({
        playbook: playbookContext,
        targetAudience: matched.name, // Use canonical name from playbook
        hooks,
        contentType: body.contentType || 'organic_post',
        platform: body.platform || 'both',
        count: audienceNames.length === 1 ? (body.count || 5) : countPerAudience,
      })
      allVariations.push(result)
    }

    // Merge results
    const result = {
      variations: allVariations.flatMap((r) => r.variations),
      metadata: allVariations[0].metadata,
    }

    // Store generated content
    const createdContent = await Promise.all(
      result.variations.map((variation) =>
        prisma.content.create({
          data: {
            campaignId: campaign.id,
            type: body.contentType || 'organic_post',
            status: 'generated',
            headline: variation.headline,
            body: variation.body,
            ctaText: variation.ctaText,
            hookSource: variation.hookSource,
            audienceSegment: variation.audienceSegment,
            pillar: variation.pillar || null,
            archetype: variation.archetype || null,
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
            } as Prisma.InputJsonValue,
          },
          include: {
            campaign: {
              select: { id: true, name: true },
            },
          },
        })
      )
    )

    return successResponse({
      content: createdContent,
      metadata: result.metadata,
    }, 201)
  } catch (error) {
    // If it's an audience lookup error, return 400 instead of 500
    if (error instanceof Error && error.message.includes('not found in playbook')) {
      return errorResponse(error.message, 400)
    }
    return serverErrorResponse(error, 'Failed to generate content')
  }
}
