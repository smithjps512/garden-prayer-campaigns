import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  serverErrorResponse,
  parseBody,
} from '@/lib/api'
import { deleteFile } from '@/lib/storage'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/images/:id - Get image details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const { id } = await params

    const image = await prisma.image.findUnique({
      where: { id },
      include: {
        business: {
          select: { id: true, name: true, slug: true },
        },
        contents: {
          select: { id: true, headline: true, status: true },
          take: 10,
        },
      },
    })

    if (!image) {
      return notFoundResponse('Image not found')
    }

    return successResponse(image)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch image')
  }
}

// PUT /api/images/:id - Update image metadata
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const { id } = await params

    const existing = await prisma.image.findUnique({
      where: { id },
    })

    if (!existing) {
      return notFoundResponse('Image not found')
    }

    interface UpdateImageInput {
      type?: 'product' | 'generic' | 'video_thumbnail'
      category?: string
      tags?: {
        segments?: string[]
        emotions?: string[]
        themes?: string[]
      }
      altText?: string
    }

    const body = await parseBody<UpdateImageInput>(request)

    const image = await prisma.image.update({
      where: { id },
      data: {
        ...(body.type && { type: body.type }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.tags && { tags: body.tags }),
        ...(body.altText !== undefined && { altText: body.altText }),
      },
      include: {
        business: {
          select: { id: true, name: true, slug: true },
        },
      },
    })

    return successResponse(image)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to update image')
  }
}

// DELETE /api/images/:id - Delete image
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const { id } = await params

    const image = await prisma.image.findUnique({
      where: { id },
    })

    if (!image) {
      return notFoundResponse('Image not found')
    }

    // Try to delete from storage
    try {
      // Extract key from URL
      const url = new URL(image.storageUrl)
      const key = url.pathname.substring(1) // Remove leading slash
      await deleteFile(key)
    } catch (storageError) {
      console.error('Failed to delete from storage:', storageError)
      // Continue with database deletion even if storage delete fails
    }

    // Delete from database
    await prisma.image.delete({
      where: { id },
    })

    return successResponse({ message: 'Image deleted successfully' })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to delete image')
  }
}
