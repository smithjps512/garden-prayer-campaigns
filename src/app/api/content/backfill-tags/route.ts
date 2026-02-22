import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { classifyContentTags } from '@/lib/claude'

// POST /api/content/backfill-tags — Classify and tag existing untagged content
export async function POST(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const body = await parseBody<{
      campaignId?: string
      limit?: number
    }>(request)

    // Find untagged content
    const where = {
      pillar: null,
      ...(body.campaignId ? { campaignId: body.campaignId } : {}),
    }

    const untaggedContent = await prisma.content.findMany({
      where,
      select: {
        id: true,
        headline: true,
        body: true,
        audienceSegment: true,
      },
      take: body.limit || 50,
    })

    if (untaggedContent.length === 0) {
      return successResponse({ tagged: 0, message: 'No untagged content found' })
    }

    let tagged = 0
    let failed = 0

    for (const content of untaggedContent) {
      if (!content.headline && !content.body) {
        failed++
        continue
      }

      try {
        const tags = await classifyContentTags(
          content.headline || '',
          content.body || ''
        )

        await prisma.content.update({
          where: { id: content.id },
          data: {
            pillar: tags.pillar,
            archetype: tags.archetype,
          },
        })

        tagged++
      } catch {
        failed++
      }
    }

    return successResponse({ tagged, failed, total: untaggedContent.length })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to backfill content tags')
  }
}
