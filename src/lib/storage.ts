import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

// Initialize Supabase client for storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const BUCKET = 'images'

export interface UploadResult {
  key: string
  url: string
  bucket: string
}

export interface UploadOptions {
  contentType: string
  folder?: string
  filename?: string
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  file: Buffer | Uint8Array,
  options: UploadOptions
): Promise<UploadResult> {
  const extension = getExtensionFromMimeType(options.contentType)
  const filename = options.filename || `${uuidv4()}${extension}`
  const folder = options.folder || 'uploads'
  const key = `${folder}/${filename}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, file, {
      contentType: options.contentType,
      upsert: false,
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  const url = getPublicUrl(key)

  return {
    key,
    url,
    bucket: BUCKET,
  }
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(key: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([key])

  if (error) {
    throw new Error(`Delete failed: ${error.message}`)
  }
}

/**
 * Get a signed URL for private file access
 */
export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(key, expiresIn)

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`)
  }

  return data.signedUrl
}

/**
 * Get the public URL for a file (bucket must be public)
 */
export function getPublicUrl(key: string): string {
  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(key)

  return data.publicUrl
}

/**
 * Generate a unique key for file upload
 */
export function generateFileKey(folder: string, originalFilename: string): string {
  const extension = originalFilename.split('.').pop() || ''
  const uniqueId = uuidv4()
  return `${folder}/${uniqueId}.${extension}`
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
  }

  return mimeToExt[mimeType] || ''
}

/**
 * Validate file is an allowed image type
 */
export function isValidImageType(mimeType: string): boolean {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  return allowedTypes.includes(mimeType)
}

/**
 * Get max file size in bytes (10MB default)
 */
export function getMaxFileSize(): number {
  return 10 * 1024 * 1024 // 10MB
}
