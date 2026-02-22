import { NextRequest } from 'next/server'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { scoreContent, scoreAllForCampaign } from '@/lib/scoring'

// POST /api/content/score — Score one content piece or all for a campaign
export async function POST(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const body = await parseBody<{
      contentId?: string
      campaignId?: string
    }>(request)

    if (!body.contentId && !body.campaignId) {
      return errorResponse('Either contentId or campaignId is required', 400)
    }

    if (body.contentId) {
      const score = await scoreContent(body.contentId)
      return successResponse({ contentId: body.contentId, score })
    }

    const result = await scoreAllForCampaign(body.campaignId!)
    return successResponse({
      campaignId: body.campaignId,
      ...result,
    })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to score content')
  }
}
