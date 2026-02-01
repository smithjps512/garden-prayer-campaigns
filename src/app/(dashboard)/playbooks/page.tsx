'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Business {
  id: string
  name: string
  slug: string
}

interface Playbook {
  id: string
  name: string
  status: 'draft' | 'active' | 'archived'
  version: number
  positioning: string | null
  createdAt: string
  updatedAt: string
  business: Business
  _count: {
    campaigns: number
  }
}

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [filterBusiness, setFilterBusiness] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    fetchPlaybooks()
    fetchBusinesses()
  }, [filterBusiness, filterStatus])

  async function fetchPlaybooks() {
    try {
      const params = new URLSearchParams()
      if (filterBusiness) params.append('businessId', filterBusiness)
      if (filterStatus) params.append('status', filterStatus)

      const res = await fetch(`/api/playbooks?${params}`)
      const data = await res.json()
      if (data.success) {
        setPlaybooks(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch playbooks:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchBusinesses() {
    try {
      const res = await fetch('/api/businesses')
      const data = await res.json()
      if (data.success) {
        // Handle paginated response
        setBusinesses(data.data.items || data.data)
      }
    } catch (error) {
      console.error('Failed to fetch businesses:', error)
    }
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      archived: 'bg-yellow-100 text-yellow-800',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Playbooks</h1>
          <p className="text-gray-600">Strategic marketing playbooks for your campaigns</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Playbook
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filterBusiness}
          onChange={(e) => setFilterBusiness(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Businesses</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Playbooks Grid */}
      {playbooks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No playbooks</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new playbook.</p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + New Playbook
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {playbooks.map((playbook) => (
            <Link
              key={playbook.id}
              href={`/playbooks/${playbook.id}`}
              className="block bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{playbook.name}</h3>
                  <p className="text-sm text-gray-500">{playbook.business.name}</p>
                </div>
                {getStatusBadge(playbook.status)}
              </div>

              {playbook.positioning && (
                <p className="mt-3 text-sm text-gray-600 line-clamp-2">{playbook.positioning}</p>
              )}

              <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                <span>v{playbook.version}</span>
                <span>{playbook._count.campaigns} campaigns</span>
              </div>

              <div className="mt-2 text-xs text-gray-400">
                Updated {new Date(playbook.updatedAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreatePlaybookModal
          businesses={businesses}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            fetchPlaybooks()
          }}
        />
      )}
    </div>
  )
}

function CreatePlaybookModal({
  businesses,
  onClose,
  onCreated,
}: {
  businesses: Business[]
  onClose: () => void
  onCreated: () => void
}) {
  const [mode, setMode] = useState<'manual' | 'generate'>('manual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Manual mode fields
  const [businessId, setBusinessId] = useState(businesses[0]?.id || '')
  const [name, setName] = useState('')
  const [positioning, setPositioning] = useState('')

  // Generate mode fields
  const [brief, setBrief] = useState({
    businessName: '',
    industry: '',
    product: '',
    pricePoint: '',
    targetMarket: '',
    competitors: '',
    uniqueValue: '',
    founderStory: '',
  })

  async function handleCreate() {
    if (!businessId || !name) {
      setError('Business and name are required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const endpoint = mode === 'generate' ? '/api/playbooks/generate' : '/api/playbooks'
      const body =
        mode === 'generate'
          ? { businessId, name, brief }
          : { businessId, name, positioning }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (data.success) {
        onCreated()
      } else {
        setError(data.error || 'Failed to create playbook')
      }
    } catch {
      setError('Failed to create playbook')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Create New Playbook</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setMode('manual')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'manual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Manual
            </button>
            <button
              onClick={() => setMode('generate')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'generate'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              AI Generate
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business</label>
            <select
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Playbook Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 2026 Launch Playbook"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {mode === 'manual' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Positioning</label>
              <textarea
                value={positioning}
                onChange={(e) => setPositioning(e.target.value)}
                placeholder="Core positioning statement..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          ) : (
            <div className="space-y-4 border-t border-gray-200 pt-4">
              <p className="text-sm text-gray-600">
                Provide details about your business and AI will generate a complete playbook.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                  <input
                    type="text"
                    value={brief.businessName}
                    onChange={(e) => setBrief({ ...brief, businessName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                  <input
                    type="text"
                    value={brief.industry}
                    onChange={(e) => setBrief({ ...brief, industry: e.target.value })}
                    placeholder="e.g., Education, Real Estate"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product/Service</label>
                <input
                  type="text"
                  value={brief.product}
                  onChange={(e) => setBrief({ ...brief, product: e.target.value })}
                  placeholder="What do you sell?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price Point</label>
                  <input
                    type="text"
                    value={brief.pricePoint}
                    onChange={(e) => setBrief({ ...brief, pricePoint: e.target.value })}
                    placeholder="e.g., $99/year"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Market</label>
                  <input
                    type="text"
                    value={brief.targetMarket}
                    onChange={(e) => setBrief({ ...brief, targetMarket: e.target.value })}
                    placeholder="e.g., US Teachers"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unique Value Proposition</label>
                <textarea
                  value={brief.uniqueValue}
                  onChange={(e) => setBrief({ ...brief, uniqueValue: e.target.value })}
                  placeholder="What makes you different?"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Competitors (optional)
                </label>
                <input
                  type="text"
                  value={brief.competitors}
                  onChange={(e) => setBrief({ ...brief, competitors: e.target.value })}
                  placeholder="e.g., Competitor A, Competitor B"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Founder Story (optional)
                </label>
                <textarea
                  value={brief.founderStory}
                  onChange={(e) => setBrief({ ...brief, founderStory: e.target.value })}
                  placeholder="The story behind the business..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? (mode === 'generate' ? 'Generating...' : 'Creating...') : 'Create Playbook'}
          </button>
        </div>
      </div>
    </div>
  )
}
