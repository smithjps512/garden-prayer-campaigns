import { getSession } from '@/lib/auth'
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return unauthorizedResponse('Not authenticated')
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    if (!user) {
      return unauthorizedResponse('User not found')
    }

    return successResponse({ user })
  } catch (error) {
    return serverErrorResponse(error, 'Session check failed')
  }
}
