import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth'
import { getPages } from '@/lib/meta'
import { successResponse, errorResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api'

/**
 * GET /api/meta/pages
 *
 * Returns the list of Facebook Pages the user can manage.
 * Reads the temporary user token from the meta-user-token cookie
 * (set during OAuth callback).
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const cookieStore = await cookies()
    const userToken = cookieStore.get('meta-user-token')?.value

    if (!userToken) {
      return errorResponse(
        'No Meta user token found. Please reconnect to Meta.',
        400
      )
    }

    const pages = await getPages(userToken)

    // Return only the fields the frontend needs (strip access_token)
    const safePages = pages.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category || null,
    }))

    return successResponse(safePages)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch Meta pages')
  }
}
