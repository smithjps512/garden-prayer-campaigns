import { clearSessionCookie } from '@/lib/auth'
import { successResponse, serverErrorResponse } from '@/lib/api'

export async function POST() {
  try {
    await clearSessionCookie()
    return successResponse({ message: 'Logged out successfully' })
  } catch (error) {
    return serverErrorResponse(error, 'Logout failed')
  }
}
