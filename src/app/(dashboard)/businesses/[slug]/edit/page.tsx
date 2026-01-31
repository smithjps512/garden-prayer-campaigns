'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Business {
  id: string
  name: string
  slug: string
  description: string | null
  websiteUrl: string | null
  brandColors: Record<string, string> | null
  metaPageId: string | null
  metaIgId: string | null
  metaAdAccount: string | null
  pixelId: string | null
  settings: Record<string, unknown> | null
}

export default function EditBusinessPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    websiteUrl: '',
    primaryColor: '#3B82F6',
    secondaryColor: '#1D4ED8',
    accentColor: '#F59E0B',
    metaPageId: '',
    metaIgId: '',
    metaAdAccount: '',
    pixelId: '',
  })

  useEffect(() => {
    async function fetchBusiness() {
      try {
        const response = await fetch(`/api/businesses/${slug}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to load business')
          return
        }

        const business: Business = data.data
        const colors = business.brandColors || {}

        setFormData({
          name: business.name,
          slug: business.slug,
          description: business.description || '',
          websiteUrl: business.websiteUrl || '',
          primaryColor: colors.primary || '#3B82F6',
          secondaryColor: colors.secondary || '#1D4ED8',
          accentColor: colors.accent || '#F59E0B',
          metaPageId: business.metaPageId || '',
          metaIgId: business.metaIgId || '',
          metaAdAccount: business.metaAdAccount || '',
          pixelId: business.pixelId || '',
        })
      } catch {
        setError('Failed to load business')
      } finally {
        setLoading(false)
      }
    }

    fetchBusiness()
  }, [slug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const response = await fetch(`/api/businesses/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || null,
          websiteUrl: formData.websiteUrl || null,
          brandColors: {
            primary: formData.primaryColor,
            secondary: formData.secondaryColor,
            accent: formData.accentColor,
          },
          metaPageId: formData.metaPageId || null,
          metaIgId: formData.metaIgId || null,
          metaAdAccount: formData.metaAdAccount || null,
          pixelId: formData.pixelId || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to update business')
        return
      }

      router.push(`/businesses/${data.data.slug}`)
      router.refresh()
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/businesses/${slug}`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Business
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Edit Business</h1>
          <p className="text-sm text-gray-500 mt-1">Update business details and settings</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Business Name *
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
              URL Slug
            </label>
            <div className="mt-1 flex rounded-lg shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                /businesses/
              </span>
              <input
                type="text"
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                className="flex-1 block w-full px-3 py-2 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="websiteUrl" className="block text-sm font-medium text-gray-700">
              Website URL
            </label>
            <input
              type="url"
              id="websiteUrl"
              value={formData.websiteUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, websiteUrl: e.target.value }))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Brand Colors</label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="primaryColor" className="block text-xs text-gray-500 mb-1">
                  Primary
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    id="primaryColor"
                    value={formData.primaryColor}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))
                    }
                    className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.primaryColor}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))
                    }
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="secondaryColor" className="block text-xs text-gray-500 mb-1">
                  Secondary
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    id="secondaryColor"
                    value={formData.secondaryColor}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, secondaryColor: e.target.value }))
                    }
                    className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.secondaryColor}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, secondaryColor: e.target.value }))
                    }
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="accentColor" className="block text-xs text-gray-500 mb-1">
                  Accent
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    id="accentColor"
                    value={formData.accentColor}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, accentColor: e.target.value }))
                    }
                    className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.accentColor}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, accentColor: e.target.value }))
                    }
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Meta Integration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="metaPageId" className="block text-sm font-medium text-gray-700">
                  Facebook Page ID
                </label>
                <input
                  type="text"
                  id="metaPageId"
                  value={formData.metaPageId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, metaPageId: e.target.value }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="metaIgId" className="block text-sm font-medium text-gray-700">
                  Instagram ID
                </label>
                <input
                  type="text"
                  id="metaIgId"
                  value={formData.metaIgId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, metaIgId: e.target.value }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="metaAdAccount" className="block text-sm font-medium text-gray-700">
                  Ad Account ID
                </label>
                <input
                  type="text"
                  id="metaAdAccount"
                  value={formData.metaAdAccount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, metaAdAccount: e.target.value }))
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="pixelId" className="block text-sm font-medium text-gray-700">
                  Pixel ID
                </label>
                <input
                  type="text"
                  id="pixelId"
                  value={formData.pixelId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, pixelId: e.target.value }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <Link
              href={`/businesses/${slug}`}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !formData.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
