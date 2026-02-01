import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, serverErrorResponse } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { Prisma } from '@prisma/client'

// GET /api/tasks - List tasks with filters
export async function GET(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')
    const assignee = searchParams.get('assignee')
    const status = searchParams.get('status')
    const businessId = searchParams.get('businessId')

    const where: Prisma.TaskWhereInput = {}
    if (campaignId) where.campaignId = campaignId
    if (assignee) where.assignee = assignee as Prisma.EnumTaskAssigneeFilter['equals']
    if (status) where.status = status as Prisma.EnumTaskStatusFilter['equals']
    if (businessId) {
      where.campaign = {
        playbook: { businessId },
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            playbook: {
              select: {
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
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }],
    })

    return successResponse(tasks)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch tasks')
  }
}
