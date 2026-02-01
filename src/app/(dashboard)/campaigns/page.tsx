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
  business: Business
}

interface Campaign {
  id: string
  name: string
  status: string
  targetAudience: string | null
  budgetDaily: number | null
  budgetTotal: number | null
  startDate: string | null
  createdAt: string
  updatedAt: string
  playbook: Playbook
  _count: {
    contents: number
    tasks: number
  }
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  setup: 'bg-purple-100 text-purple-800',
  live: 'bg-green-100 text-green-800',
  paused: 'bg-orange-100 text-orange-800',
  completed: 'bg-gray-100 text-gray-800',
  failed: 'bg-red-100 text-red-800',
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    fetchCampaigns()
    fetchPlaybooks()
  }, [filterStatus])

  async function fetchCampaigns() {
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)

      const res = await fetch(`/api/campaigns?${params}`)
      const data = await res.json()
      if (data.success) {
        setCampaigns(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchPlaybooks() {
    try {
      const res = await fetch('/api/playbooks?status=active')
      const data = await res.json()
      if (data.success) {
        setPlaybooks(data.data)
      }
      // Also get draft playbooks if no active ones
      if (data.data?.length === 0) {
        const draftRes = await fetch('/api/playbooks')
        const draftData = await draftRes.json()
        if (draftData.success) {
          setPlaybooks(draftData.data)
        }
      }
    } catch (error) {
      console.error('Failed to fetch playbooks:', error)
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-600">Manage your marketing campaigns and track performance</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="review">Review</option>
          <option value="approved">Approved</option>
          <option value="setup">Setup</option>
          <option value="live">Live</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Campaigns List */}
      {campaigns.length === 0 ? (
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
              d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No campaigns</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new campaign.</p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + New Campaign
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/campaigns/${campaign.id}`}
              className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[campaign.status]}`}
                  >
                    {campaign.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {campaign.playbook.business.name} • {campaign.playbook.name}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span>{campaign._count.contents} content</span>
                  <span>{campaign._count.tasks} tasks</span>
                  {campaign.budgetDaily && (
                    <span>${campaign.budgetDaily}/day</span>
                  )}
                  {campaign.targetAudience && (
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                      {campaign.targetAudience}
                    </span>
                  )}
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCampaignModal
          playbooks={playbooks}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            fetchCampaigns()
          }}
        />
      )}
    </div>
  )
}

function CreateCampaignModal({
  playbooks,
  onClose,
  onCreated,
}: {
  playbooks: Playbook[]
  onClose: () => void
  onCreated: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [playbookId, setPlaybookId] = useState(playbooks[0]?.id || '')
  const [name, setName] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [budgetDaily, setBudgetDaily] = useState('')
  const [channels, setChannels] = useState<string[]>(['facebook', 'instagram'])

  async function handleCreate() {
    if (!playbookId || !name) {
      setError('Playbook and name are required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playbookId,
          name,
          targetAudience: targetAudience || undefined,
          budgetDaily: budgetDaily ? parseFloat(budgetDaily) : undefined,
          channels,
        }),
      })

      const data = await res.json()
      if (data.success) {
        onCreated()
      } else {
        setError(data.error || 'Failed to create campaign')
      }
    } catch {
      setError('Failed to create campaign')
    } finally {
      setLoading(false)
    }
  }

  function toggleChannel(channel: string) {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full m-4">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Create New Campaign</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error}</div>
          )}

          {playbooks.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500">No playbooks available. Create a playbook first.</p>
              <Link href="/playbooks" className="text-blue-600 hover:underline mt-2 block">
                Go to Playbooks
              </Link>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Playbook</label>
                <select
                  value={playbookId}
                  onChange={(e) => setPlaybookId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {playbooks.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.business.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., TIA Seekers - ROI Campaign"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Audience (optional)
                </label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g., TIA Seekers"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Daily Budget (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={budgetDaily}
                    onChange={(e) => setBudgetDaily(e.target.value)}
                    placeholder="50"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Channels</label>
                <div className="flex gap-3">
                  {['facebook', 'instagram'].map((channel) => (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => toggleChannel(channel)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                        channels.includes(channel)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {channel}
                    </button>
                  ))}
                </div>
              </div>
            </>
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
            disabled={loading || playbooks.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </div>
    </div>
  )
}
