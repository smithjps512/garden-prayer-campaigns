import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

// Initialize S3 client - supports both AWS S3 and Cloudflare R2
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'auto',
  endpoint: process.env.R2_ENDPOINT, // Only set for R2
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: !!process.env.R2_ENDPOINT, // Required for R2
})

const BUCKET = process.env.AWS_S3_BUCKET || process.env.R2_BUCKET || 'campaign-engine-images'

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
 * Upload a file to S3/R2 storage
 */
export async function uploadFile(
  file: Buffer | Uint8Array,
  options: UploadOptions
): Promise<UploadResult> {
  const extension = getExtensionFromMimeType(options.contentType)
  const filename = options.filename || `${uuidv4()}${extension}`
  const folder = options.folder || 'uploads'
  const key = `${folder}/${filename}`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file,
      ContentType: options.contentType,
    })
  )

  const url = getPublicUrl(key)

  return {
    key,
    url,
    bucket: BUCKET,
  }
}

/**
 * Delete a file from S3/R2 storage
 */
export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  )
}

/**
 * Get a signed URL for private file access
 */
export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })

  return getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Get a signed URL for direct upload from client
 */
export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })

  return getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Get the public URL for a file (if bucket has public access)
 */
export function getPublicUrl(key: string): string {
  if (process.env.R2_ENDPOINT) {
    // For R2, you'd typically use a custom domain or R2 public URL
    return `${process.env.R2_PUBLIC_URL || process.env.R2_ENDPOINT}/${key}`
  }
  // For AWS S3
  return `https://${BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`
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
