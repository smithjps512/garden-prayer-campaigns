import { NextRequest } from 'next/server'
import { authenticateUser, createSession, setSessionCookie } from '@/lib/auth'
import { successResponse, errorResponse, serverErrorResponse, parseBody } from '@/lib/api'

interface LoginRequest {
  email: string
  password: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseBody<LoginRequest>(request)
    const { email, password } = body

    if (!email || !password) {
      return errorResponse('Email and password are required', 400)
    }

    const user = await authenticateUser(email, password)

    if (!user) {
      return errorResponse('Invalid email or password', 401)
    }

    const token = await createSession(user.id, user.email)
    await setSessionCookie(token)

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })
  } catch (error) {
    return serverErrorResponse(error, 'Login failed')
  }
}
