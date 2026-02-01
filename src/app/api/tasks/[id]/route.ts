import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { Prisma } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/tasks/:id - Get task details
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()
    const { id } = await context.params

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            playbook: {
              select: {
                id: true,
                name: true,
                business: {
                  select: { id: true, name: true, slug: true },
                },
              },
            },
          },
        },
        dependsOn: {
          select: { id: true, title: true, status: true },
        },
        dependentTasks: {
          select: { id: true, title: true, status: true },
        },
      },
    })

    if (!task) {
      return errorResponse('Task not found', 404)
    }

    return successResponse(task)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch task')
  }
}

// PUT /api/tasks/:id - Update task
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    await ensureAuthenticated()
    const { id } = await context.params

    const body = await parseBody<{
      title?: string
      description?: string
      instructions?: string
      priority?: number
      dueDate?: string
      status?: 'pending' | 'in_progress' | 'completed' | 'blocked'
    }>(request)

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

    const updateData: Prisma.TaskUpdateInput = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.instructions !== undefined) updateData.instructions = body.instructions
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null
    if (body.status !== undefined) {
      updateData.status = body.status
      if (body.status === 'completed') {
        updateData.completedAt = new Date()
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
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
        action: 'task_updated',
        entityType: 'task',
        entityId: id,
        details: { changes: Object.keys(body) } as Prisma.InputJsonValue,
      },
    })

    return successResponse(task)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to update task')
  }
}
