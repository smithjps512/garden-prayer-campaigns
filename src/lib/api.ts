import { NextResponse } from 'next/server'

export type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status })
}

export function errorResponse(error: string, status = 400): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status })
}

export function notFoundResponse(message = 'Resource not found'): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error: message }, { status: 404 })
}

export function unauthorizedResponse(message = 'Unauthorized'): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error: message }, { status: 401 })
}

export function serverErrorResponse(
  error: unknown,
  message = 'Internal server error'
): NextResponse<ApiResponse> {
  console.error('Server error:', error)
  return NextResponse.json({ success: false, error: message }, { status: 500 })
}

export function validationErrorResponse(errors: Record<string, string>): NextResponse<ApiResponse> {
  return NextResponse.json(
    { success: false, error: 'Validation failed', data: errors },
    { status: 422 }
  )
}

/**
 * Parse and validate JSON body from request
 */
export async function parseBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new Error('Invalid JSON body')
  }
}

/**
 * Extract query parameters from URL
 */
export function getQueryParams(request: Request): URLSearchParams {
  const url = new URL(request.url)
  return url.searchParams
}

/**
 * Pagination helper
 */
export interface PaginationParams {
  page: number
  limit: number
  skip: number
}

export function getPagination(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

/**
 * Create paginated response
 */
export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  pagination: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / pagination.limit)

  return {
    items,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
      hasMore: pagination.page < totalPages,
    },
  }
}
