import { NextRequest } from 'next/server'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { parseDocumentsToPlaybook } from '@/lib/document-parser'

// POST /api/playbooks/parse - Parse uploaded documents into playbook structure
export async function POST(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const businessName = formData.get('businessName') as string

    if (!files || files.length === 0) {
      return errorResponse('At least one file is required', 400)
    }

    if (!businessName) {
      return errorResponse('Business name is required', 400)
    }

    // Validate file types
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ]
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.md']

    for (const file of files) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
        return errorResponse(
          `Invalid file type: ${file.name}. Allowed types: PDF, DOCX, TXT, MD`,
          400
        )
      }
    }

    // Parse documents and extract playbook content
    const playbook = await parseDocumentsToPlaybook(files, businessName)

    return successResponse({
      playbook,
      filesProcessed: files.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      })),
    })
  } catch (error) {
    console.error('Document parsing error:', error)
    return serverErrorResponse(error, 'Failed to parse documents')
  }
}
