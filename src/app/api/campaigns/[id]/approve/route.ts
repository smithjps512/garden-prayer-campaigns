import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'
import { ensureAuthenticated, getSession } from '@/lib/auth'
import { Prisma } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Default tasks generated on campaign approval
const DEFAULT_HUMAN_TASKS = [
  {
    type: 'review_content',
    title: 'Review Generated Content',
    description: 'Review all AI-generated content for brand voice and accuracy',
    priority: 8,
  },
  {
    type: 'upload_images',
    title: 'Upload Campaign Images',
    description: 'Upload images for content that needs visuals',
    priority: 7,
  },
  {
    type: 'setup_meta',
    title: 'Configure Meta Ads Manager',
    description: 'Set up ad sets and targeting in Meta Business Suite',
    priority: 9,
  },
]

const DEFAULT_SYSTEM_TASKS = [
  {
    type: 'generate_content',
    title: 'Generate Initial Content Batch',
    description: 'AI generates content variations from playbook',
    priority: 10,
  },
  {
    type: 'match_images',
    title: 'Match Images to Content',
    description: 'Auto-match library images to generated content',
    priority: 6,
  },
  {
    type: 'generate_utm',
    title: 'Generate UTM Parameters',
    description: 'Create tracking parameters for all content',
    priority: 5,
  },
]

// POST /api/campaigns/:id/approve - Approve campaign and generate tasks
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await ensureAuthenticated()
    const { id } = await context.params

    // Get campaign
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        playbook: {
          select: { businessId: true, positioning: true, hooks: true, audiences: true },
        },
        _count: { select: { contents: true } },
      },
    })

    if (!campaign) {
      return errorResponse('Campaign not found', 404)
    }

    // Validate campaign can be approved
    if (campaign.status !== 'draft' && campaign.status !== 'review') {
      return errorResponse(`Campaign cannot be approved from ${campaign.status} status`, 400)
    }

    // Validate playbook has required content
    if (!campaign.playbook.positioning || !campaign.playbook.hooks || !campaign.playbook.audiences) {
      return errorResponse('Playbook must have positioning, hooks, and audiences before campaign approval', 400)
    }

    // Create tasks
    const humanTasks = DEFAULT_HUMAN_TASKS.map((task) => ({
      campaignId: id,
      assignee: 'human' as const,
      ...task,
      status: 'pending' as const,
    }))

    const systemTasks = DEFAULT_SYSTEM_TASKS.map((task) => ({
      campaignId: id,
      assignee: 'system' as const,
      ...task,
      status: 'pending' as const,
    }))

    // Create all tasks
    await prisma.task.createMany({
      data: [...humanTasks, ...systemTasks],
    })

    // Update campaign status
    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: session.email,
        humanTasks: DEFAULT_HUMAN_TASKS as unknown as Prisma.InputJsonValue,
        aiTasks: DEFAULT_SYSTEM_TASKS as unknown as Prisma.InputJsonValue,
      },
      include: {
        playbook: {
          select: {
            id: true,
            name: true,
            business: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        tasks: {
          select: { id: true, assignee: true, type: true, title: true, status: true },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        businessId: campaign.playbook.businessId,
        campaignId: id,
        actor: 'human',
        action: 'campaign_approved',
        entityType: 'campaign',
        entityId: id,
        details: {
          approvedBy: session.email,
          tasksCreated: humanTasks.length + systemTasks.length,
        } as Prisma.InputJsonValue,
      },
    })

    return successResponse(updatedCampaign)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to approve campaign')
  }
}
