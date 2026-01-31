import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { successResponse, serverErrorResponse } from '@/lib/api'

// Temporary setup endpoint to create/reset admin user
// DELETE THIS AFTER FIRST USE
export async function POST(request: NextRequest) {
  try {
    const password = 'admin123'
    const email = 'admin@campaignengine.local'

    const passwordHash = await hashPassword(password)

    // Update existing user or create new one
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: {
        email,
        passwordHash,
        name: 'Admin',
      },
    })

    return successResponse({
      message: 'Admin user ready',
      email: user.email,
      password: password,
    })
  } catch (error) {
    return serverErrorResponse(error, 'Setup failed')
  }
}
