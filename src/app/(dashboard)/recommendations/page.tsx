'use client'

import { useState, useEffect, useCallback } from 'react'

interface Campaign {
  id: string
  name: string
  playbook: {
    business: { id: string; name: string }
  }
}

interface Recommendation {
  id: string
  campaignId: string
  type: string
  title: string
  reasoning: string
  actionData: Record<string, unknown>
  status: string
  outcome: string | null
  createdAt: string
  updatedAt: string
  campaign: Campaign
}

interface Stats {
  pending: number
  accepted: number
  dismissed: number
  executed: number
}

const typeBadgeColors: Record<string, string> = {
  amplify: 'bg-green-100 text-green-700',
  retire: 'bg-red-100 text-red-700',
  test: 'bg-blue-100 text-blue-700',
  iterate: 'bg-yellow-100 text-yellow-700',
}

const statusBadgeColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  accepted: 'bg-blue-100 text-blue-700',
  dismissed: 'bg-gray-100 text-gray-400',
  executed: 'bg-green-100 text-green-700',
}

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [stats, setStats] = useState<Stats>({ pending: 0, accepted: 0, dismissed: 0, executed: 0 })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')

  const fetchRecommendations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (filterType) params.set('type', filterType)

      const res = await fetch(`/api/recommendations?${params}`)
      const json = await res.json()
      if (json.success) {
        setRecommendations(json.data.recommendations)
        setStats(json.data.stats)
      }
    } catch {
      console.error('Failed to fetch recommendations')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterType])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  async function handleAction(id: string, action: 'accept' | 'dismiss') {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/recommendations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (json.success) {
        await fetchRecommendations()
      }
    } catch {
      // Silent
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recommendations</h1>
          <p className="text-gray-500 mt-1">AI-powered suggestions to optimize your content strategy</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="text-gray-500 mt-3">Loading recommendations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recommendations</h1>
        <p className="text-gray-500 mt-1">AI-powered suggestions to optimize your content strategy</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Executed</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.executed}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Accepted</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.accepted}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Dismissed</p>
          <p className="text-2xl font-bold text-gray-400 mt-1">{stats.dismissed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="executed">Executed</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Types</option>
          <option value="amplify">Amplify</option>
          <option value="retire">Retire</option>
          <option value="test">Test</option>
          <option value="iterate">Iterate</option>
        </select>
      </div>

      {/* Recommendations List */}
      {recommendations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No Recommendations Yet</h3>
          <p className="mt-2 text-gray-500 text-sm">
            AI recommendations are generated weekly from your content performance data.
            Make sure you have active campaigns with scored content.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec) => {
            const isLoading = actionLoading === rec.id

            return (
              <div key={rec.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadgeColors[rec.type] || 'bg-gray-100 text-gray-700'}`}>
                        {rec.type}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeColors[rec.status] || 'bg-gray-100 text-gray-700'}`}>
                        {rec.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {rec.campaign.name}
                      </span>
                    </div>
                    <h3 className="font-medium text-gray-900">{rec.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{rec.reasoning}</p>

                    {/* Action data summary */}
                    {rec.actionData && Object.keys(rec.actionData).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {'pillar' in rec.actionData && rec.actionData.pillar ? (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            Pillar: {String(rec.actionData.pillar)}
                          </span>
                        ) : null}
                        {'archetype' in rec.actionData && rec.actionData.archetype ? (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            Archetype: {String(rec.actionData.archetype)}
                          </span>
                        ) : null}
                        {'audience' in rec.actionData && rec.actionData.audience ? (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            Audience: {String(rec.actionData.audience)}
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* Outcome for executed recommendations */}
                    {rec.outcome && (
                      <p className="text-xs text-green-600 mt-2 bg-green-50 px-2 py-1 rounded">
                        {rec.outcome}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  {rec.status === 'pending' && (
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <button
                        onClick={() => handleAction(rec.id, 'accept')}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {isLoading ? 'Processing...' : 'Accept'}
                      </button>
                      <button
                        onClick={() => handleAction(rec.id, 'dismiss')}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">
                    {rec.campaign.playbook.business.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(rec.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
