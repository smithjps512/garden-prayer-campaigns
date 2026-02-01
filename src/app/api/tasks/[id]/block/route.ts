import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { Prisma } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/tasks/:id/block - Mark task as blocked
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()
    const { id } = await context.params

    const body = await parseBody<{
      reason: string
    }>(request)

    if (!body.reason) {
      return errorResponse('Reason is required when blocking a task', 400)
    }

    const existing = await prisma.task.findUnique({
      where: { id },
      include: {
        campaign: {
          select: { playbook: { select: { businessId: true } } },
        },
      },
    })

    if (!existing) {
      return errorResponse('Task not found', 404)
    }

    if (existing.status === 'completed') {
      return errorResponse('Cannot block a completed task', 400)
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        status: 'blocked',
        completionNotes: `BLOCKED: ${body.reason}`,
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
        actor: 'human',
        action: 'task_blocked',
        entityType: 'task',
        entityId: id,
        details: {
          title: existing.title,
          reason: body.reason,
        } as Prisma.InputJsonValue,
      },
    })

    // Create escalation for blocked task
    await prisma.escalation.create({
      data: {
        campaignId: existing.campaignId,
        type: 'persistent_failure',
        severity: 'warning',
        title: `Task Blocked: ${existing.title}`,
        description: body.reason,
        status: 'open',
      },
    })

    return successResponse(task)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to block task')
  }
}
