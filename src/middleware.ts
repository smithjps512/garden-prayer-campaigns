import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from '@/lib/auth'

// Routes that don't require authentication
const publicRoutes = ['/login', '/api/auth/login', '/api/auth/setup']

// Routes that are always public (static assets, etc.)
const alwaysPublic = ['/_next', '/favicon.ico', '/api/webhooks']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow always-public routes
  if (alwaysPublic.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check for session cookie
  const token = request.cookies.get('campaign-engine-session')?.value

  // Check if this is a public route
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(route))

  if (!token) {
    // No token - redirect to login if not on public route
    if (!isPublicRoute) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Verify the token
  const session = await verifySession(token)

  if (!session) {
    // Invalid token - clear cookie and redirect to login
    if (!isPublicRoute) {
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('campaign-engine-session')
      return response
    }
    return NextResponse.next()
  }

  // Valid session - redirect away from login page if trying to access it
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
