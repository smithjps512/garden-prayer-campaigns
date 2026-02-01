import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { Prisma } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/tasks/:id/complete - Mark task as completed
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()
    const { id } = await context.params

    const body = await parseBody<{
      completionNotes?: string
    }>(request)

    const existing = await prisma.task.findUnique({
      where: { id },
      include: {
        campaign: {
          select: { playbook: { select: { businessId: true } } },
        },
        dependsOn: true,
      },
    })

    if (!existing) {
      return errorResponse('Task not found', 404)
    }

    if (existing.status === 'completed') {
      return errorResponse('Task is already completed', 400)
    }

    // Check if dependent task is completed
    if (existing.dependsOn && existing.dependsOn.status !== 'completed') {
      return errorResponse(
        `Cannot complete: dependent task "${existing.dependsOn.title}" is not completed`,
        400
      )
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        completionNotes: body.completionNotes,
      },
      include: {
        campaign: {
          select: { id: true, name: true },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        businessId: existing.campaign.playbook.businessId,
        campaignId: existing.campaignId,
        actor: existing.assignee === 'human' ? 'human' : 'system',
        action: 'task_completed',
        entityType: 'task',
        entityId: id,
        details: {
          title: existing.title,
          type: existing.type,
        } as Prisma.InputJsonValue,
      },
    })

    // Check if all human tasks are completed - update campaign to setup status
    const pendingHumanTasks = await prisma.task.count({
      where: {
        campaignId: existing.campaignId,
        assignee: 'human',
        status: { not: 'completed' },
      },
    })

    if (pendingHumanTasks === 0) {
      await prisma.campaign.update({
        where: { id: existing.campaignId },
        data: { status: 'setup' },
      })
    }

    return successResponse(task)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to complete task')
  }
}
