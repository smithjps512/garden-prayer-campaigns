import { NextRequest } from 'next/server'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'
import { ensureAuthenticated } from '@/lib/auth'
import { parseDocumentsToPlaybook } from '@/lib/document-parser'

export const maxDuration = 60

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

// POST /api/playbooks/parse - Parse uploaded documents into playbook structure
export async function POST(request: NextRequest) {
  try {
    await ensureAuthenticated()

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const businessName = formData.get('businessName') as string

    // Validate files present and non-empty
    if (!files || files.length === 0) {
      return errorResponse('No files received', 400)
    }

    const nonEmptyFiles = files.filter((f) => f.size > 0)
    if (nonEmptyFiles.length === 0) {
      return errorResponse('No files received', 400)
    }

    if (!businessName) {
      return errorResponse('businessName is required', 400)
    }

    // Validate file sizes
    for (const file of nonEmptyFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return errorResponse(
          `File "${file.name}" exceeds the 5MB size limit (${(file.size / 1024 / 1024).toFixed(1)}MB). Please reduce the file size and try again.`,
          400
        )
      }
    }

    // Validate file types
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ]
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.md']

    for (const file of nonEmptyFiles) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
        return errorResponse(
          `Invalid file type: ${file.name}. Allowed types: PDF, DOCX, TXT, MD`,
          400
        )
      }
    }

    // Parse documents and extract playbook content
    let playbook
    try {
      playbook = await parseDocumentsToPlaybook(nonEmptyFiles, businessName)
    } catch (parseError) {
      const detail = parseError instanceof Error ? parseError.message : String(parseError)
      console.error('Document parsing error:', parseError)
      return errorResponse(`Document parsing failed: ${detail}`, 500)
    }

    return successResponse({
      playbook,
      filesProcessed: nonEmptyFiles.map((f) => ({
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
