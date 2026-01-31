'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Business {
  id: string
  name: string
  slug: string
}

interface ImageTags {
  segments?: string[]
  emotions?: string[]
  themes?: string[]
}

interface Image {
  id: string
  filename: string
  storageUrl: string
  type: string
  category: string | null
  tags: Record<string, unknown> | null
  altText: string | null
  width: number | null
  height: number | null
  fileSize: number | null
  mimeType: string | null
  usageCount: number
  createdAt: Date | string
  business: { id: string; name: string; slug: string }
}

interface ImageLibraryProps {
  initialImages: Image[]
  businesses: Business[]
  selectedBusiness?: string
}

export default function ImageLibrary({
  initialImages,
  businesses,
  selectedBusiness,
}: ImageLibraryProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [images, setImages] = useState<Image[]>(initialImages)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<Image | null>(null)

  const [uploadForm, setUploadForm] = useState({
    businessId: selectedBusiness || businesses[0]?.slug || '',
    category: '',
    altText: '',
    type: 'generic',
    files: [] as File[],
  })

  const handleBusinessChange = (businessSlug: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (businessSlug) {
      params.set('business', businessSlug)
    } else {
      params.delete('business')
    }
    router.push(`/images?${params.toString()}`)
  }

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(f.type)
    )
    if (files.length > 0) {
      setUploadForm((prev) => ({ ...prev, files }))
      setShowUploadModal(true)
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setUploadForm((prev) => ({ ...prev, files }))
      setShowUploadModal(true)
    }
  }

  const handleUpload = async () => {
    if (uploadForm.files.length === 0 || !uploadForm.businessId) return

    setUploading(true)
    setUploadProgress(0)

    try {
      const uploadedImages: Image[] = []

      for (let i = 0; i < uploadForm.files.length; i++) {
        const file = uploadForm.files[i]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('businessId', uploadForm.businessId)
        if (uploadForm.category) formData.append('category', uploadForm.category)
        if (uploadForm.altText) formData.append('altText', uploadForm.altText)
        formData.append('type', uploadForm.type)

        const response = await fetch('/api/images/upload', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const data = await response.json()
          uploadedImages.push(data.data)
        }

        setUploadProgress(((i + 1) / uploadForm.files.length) * 100)
      }

      setImages((prev) => [...uploadedImages, ...prev])
      setShowUploadModal(false)
      setUploadForm((prev) => ({ ...prev, files: [], category: '', altText: '' }))
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDelete = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return

    try {
      const response = await fetch(`/api/images/${imageId}`, { method: 'DELETE' })
      if (response.ok) {
        setImages((prev) => prev.filter((img) => img.id !== imageId))
        setSelectedImage(null)
      }
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div>
      {/* Filters and Upload */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <select
            value={selectedBusiness || ''}
            onChange={(e) => handleBusinessChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Businesses</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm cursor-pointer">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Upload Images
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* Drop Zone / Image Grid */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        className="min-h-[400px]"
      >
        {images.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No images yet</h3>
            <p className="mt-2 text-gray-500">
              Drag and drop images here, or click the Upload button
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                onClick={() => setSelectedImage(image)}
                className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
              >
                <img
                  src={image.storageUrl}
                  alt={image.altText || image.filename}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-end">
                  <div className="w-full p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                    <p className="text-white text-xs truncate">{image.filename}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Images</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business *
                </label>
                <select
                  value={uploadForm.businessId}
                  onChange={(e) =>
                    setUploadForm((prev) => ({ ...prev, businessId: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={uploadForm.type}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="generic">Generic</option>
                  <option value="product">Product</option>
                  <option value="video_thumbnail">Video Thumbnail</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={uploadForm.category}
                  onChange={(e) =>
                    setUploadForm((prev) => ({ ...prev, category: e.target.value }))
                  }
                  placeholder="e.g., feature_screenshot, happy_teacher"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alt Text</label>
                <input
                  type="text"
                  value={uploadForm.altText}
                  onChange={(e) =>
                    setUploadForm((prev) => ({ ...prev, altText: e.target.value }))
                  }
                  placeholder="Description of the image"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  {uploadForm.files.length} file(s) selected
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {uploadForm.files.map((file, i) => (
                    <p key={i} className="text-sm text-gray-600 truncate">
                      {file.name} ({formatFileSize(file.size)})
                    </p>
                  ))}
                </div>
              </div>

              {uploading && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setUploadForm((prev) => ({ ...prev, files: [] }))
                }}
                disabled={uploading}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadForm.businessId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Detail Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex">
              <div className="flex-1 bg-gray-100 flex items-center justify-center p-4">
                <img
                  src={selectedImage.storageUrl}
                  alt={selectedImage.altText || selectedImage.filename}
                  className="max-w-full max-h-[60vh] object-contain"
                />
              </div>
              <div className="w-80 p-6 border-l border-gray-200 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Image Details</h3>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-gray-500">Filename</dt>
                    <dd className="text-sm font-medium text-gray-900 break-all">
                      {selectedImage.filename}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Business</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {selectedImage.business.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Type</dt>
                    <dd className="text-sm font-medium text-gray-900 capitalize">
                      {selectedImage.type.replace('_', ' ')}
                    </dd>
                  </div>
                  {selectedImage.category && (
                    <div>
                      <dt className="text-sm text-gray-500">Category</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {selectedImage.category}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm text-gray-500">Size</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {formatFileSize(selectedImage.fileSize)}
                    </dd>
                  </div>
                  {selectedImage.width && selectedImage.height && (
                    <div>
                      <dt className="text-sm text-gray-500">Dimensions</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {selectedImage.width} x {selectedImage.height}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm text-gray-500">Usage Count</dt>
                    <dd className="text-sm font-medium text-gray-900">{selectedImage.usageCount}</dd>
                  </div>
                  {selectedImage.altText && (
                    <div>
                      <dt className="text-sm text-gray-500">Alt Text</dt>
                      <dd className="text-sm font-medium text-gray-900">{selectedImage.altText}</dd>
                    </div>
                  )}
                </dl>

                {selectedImage.tags && Object.keys(selectedImage.tags).length > 0 && (() => {
                  const tags = selectedImage.tags as ImageTags
                  return (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">Tags</p>
                      {tags.segments && tags.segments.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-gray-500 mb-1">Segments</p>
                          <div className="flex flex-wrap gap-1">
                            {tags.segments.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {tags.emotions && tags.emotions.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-gray-500 mb-1">Emotions</p>
                          <div className="flex flex-wrap gap-1">
                            {tags.emotions.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {tags.themes && tags.themes.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Themes</p>
                          <div className="flex flex-wrap gap-1">
                            {tags.themes.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="mt-6 pt-4 border-t border-gray-200 flex space-x-3">
                  <a
                    href={selectedImage.storageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 text-center"
                  >
                    Open
                  </a>
                  <button
                    onClick={() => handleDelete(selectedImage.id)}
                    className="px-3 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
