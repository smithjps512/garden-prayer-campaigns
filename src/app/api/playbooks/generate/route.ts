import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { generatePlaybookFromBrief } from '@/lib/claude'
import { Prisma } from '@prisma/client'

// POST /api/playbooks/generate - AI generates playbook from brief
export async function POST(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const body = await parseBody<{
      businessId: string
      name: string
      brief: {
        businessName: string
        industry: string
        product: string
        pricePoint: string
        targetMarket: string
        competitors?: string
        uniqueValue: string
        founderStory?: string
      }
    }>(request)

    if (!body.businessId || !body.name || !body.brief) {
      return errorResponse('Business ID, name, and brief are required', 400)
    }

    // Verify business exists
    const business = await prisma.business.findUnique({
      where: { id: body.businessId },
    })

    if (!business) {
      return errorResponse('Business not found', 404)
    }

    // Generate playbook content using Claude
    const generated = await generatePlaybookFromBrief(body.brief)

    // Create playbook with generated content
    const playbook = await prisma.playbook.create({
      data: {
        businessId: body.businessId,
        name: body.name,
        positioning: generated.positioning || '',
        founderStory: body.brief.founderStory,
        audiences: generated.audiences as Prisma.InputJsonValue | undefined,
        keyMessages: generated.keyMessages as Prisma.InputJsonValue | undefined,
        objectionHandlers: generated.objectionHandlers as Prisma.InputJsonValue | undefined,
        hooks: generated.hooks as Prisma.InputJsonValue | undefined,
        status: 'draft',
      },
      include: {
        business: {
          select: { id: true, name: true, slug: true },
        },
      },
    })

    return successResponse(playbook, 201)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to generate playbook')
  }
}
