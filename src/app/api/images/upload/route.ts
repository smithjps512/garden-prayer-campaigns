import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api'
import { uploadFile, isValidImageType, getMaxFileSize, generateFileKey } from '@/lib/storage'

// POST /api/images/upload - Upload image file
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const businessId = formData.get('businessId') as string | null
    const category = formData.get('category') as string | null
    const altText = formData.get('altText') as string | null
    const type = (formData.get('type') as string | null) || 'generic'

    // Parse tags if provided
    let tags: { segments?: string[]; emotions?: string[]; themes?: string[] } | null = null
    const tagsJson = formData.get('tags') as string | null
    if (tagsJson) {
      try {
        tags = JSON.parse(tagsJson)
      } catch {
        // Ignore invalid JSON
      }
    }

    if (!file) {
      return errorResponse('No file provided', 400)
    }

    if (!businessId) {
      return errorResponse('businessId is required', 400)
    }

    // Validate file type
    if (!isValidImageType(file.type)) {
      return errorResponse('Invalid file type. Allowed: JPEG, PNG, GIF, WebP', 400)
    }

    // Validate file size
    if (file.size > getMaxFileSize()) {
      return errorResponse('File too large. Maximum size: 10MB', 400)
    }

    // Verify business exists
    const business = await prisma.business.findFirst({
      where: { OR: [{ id: businessId }, { slug: businessId }] },
    })

    if (!business) {
      return errorResponse('Business not found', 404)
    }

    // Read file content
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to S3/R2
    const folder = `businesses/${business.slug}/images`
    const result = await uploadFile(buffer, {
      contentType: file.type,
      folder,
      filename: generateFileKey(folder, file.name).split('/').pop(),
    })

    // Get image dimensions (basic implementation)
    // In production, you might want to use sharp or similar library
    let width: number | undefined
    let height: number | undefined

    // Create image record in database
    const image = await prisma.image.create({
      data: {
        businessId: business.id,
        filename: file.name,
        storageUrl: result.url,
        type: type as 'product' | 'generic' | 'video_thumbnail',
        category,
        tags: tags as Prisma.InputJsonValue | undefined,
        altText,
        width,
        height,
        fileSize: file.size,
        mimeType: file.type,
      },
      include: {
        business: {
          select: { id: true, name: true, slug: true },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        businessId: business.id,
        actor: 'human',
        action: 'image_uploaded',
        entityType: 'image',
        entityId: image.id,
        details: { filename: file.name, size: file.size },
      },
    })

    return successResponse(image, 201)
  } catch (error) {
    console.error('Upload error:', error)
    return serverErrorResponse(error, 'Failed to upload image')
  }
}
