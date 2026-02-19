'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Escalation {
  id: string
  campaignId: string
  type: string
  severity: string
  title: string
  description: string | null
  aiAnalysis: string | null
  aiRecommendation: string | null
  status: string
  humanResponse: string | null
  resolvedAt: string | null
  createdAt: string
  campaign: {
    id: string
    name: string
    playbook: {
      business: {
        id: string
        name: string
        slug: string
      }
    }
  }
}

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('active')
  const [filterSeverity, setFilterSeverity] = useState<string>('')
  const [responseModal, setResponseModal] = useState<{
    id: string
    action: string
    title: string
  } | null>(null)
  const [humanResponse, setHumanResponse] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  const fetchEscalations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (filterSeverity) params.set('severity', filterSeverity)

      const res = await fetch(`/api/escalations?${params}`)
      const json = await res.json()
      if (json.success) {
        setEscalations(json.data)
      }
    } catch {
      console.error('Failed to fetch escalations')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterSeverity])

  useEffect(() => {
    fetchEscalations()
  }, [fetchEscalations])

  async function handleAction(id: string, action: string) {
    setActionLoading(id)
    setFeedback(null)
    try {
      const res = await fetch(`/api/escalations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          humanResponse: humanResponse || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setFeedback({
          type: 'success',
          message: `Escalation ${action}d successfully`,
        })
        setResponseModal(null)
        setHumanResponse('')
        await fetchEscalations()
      } else {
        setFeedback({ type: 'error', message: json.error || 'Action failed' })
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error' })
    } finally {
      setActionLoading(null)
    }
  }

  const severityColors: Record<string, string> = {
    info: 'bg-blue-100 text-blue-800',
    warning: 'bg-yellow-100 text-yellow-800',
    critical: 'bg-red-100 text-red-800',
  }

  const statusColors: Record<string, string> = {
    open: 'bg-red-100 text-red-700',
    acknowledged: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
    dismissed: 'bg-gray-100 text-gray-700',
  }

  const typeLabels: Record<string, string> = {
    below_threshold: 'Below Threshold',
    persistent_failure: 'Persistent Failure',
    budget_depleted: 'Budget Depleted',
    anomaly_detected: 'Anomaly Detected',
    strategic_question: 'Strategic Question',
  }

  const typeIcons: Record<string, string> = {
    below_threshold: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6',
    persistent_failure: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    budget_depleted:
      'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    anomaly_detected:
      'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    strategic_question:
      'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Escalations</h1>
        <p className="text-gray-500 mt-1">Issues requiring your attention</p>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="active">Active (Open & Acknowledged)</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
          <option value="">All</option>
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="text-gray-500 mt-3">Loading escalations...</p>
        </div>
      ) : escalations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">All Clear</h3>
          <p className="mt-2 text-gray-500">
            {filterStatus === 'active'
              ? 'No active escalations requiring attention'
              : `No ${filterStatus || ''} escalations found`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {escalations.map((escalation) => (
            <div
              key={escalation.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start space-x-4">
                <div
                  className={`p-2 rounded-lg ${
                    escalation.severity === 'critical'
                      ? 'bg-red-100'
                      : escalation.severity === 'warning'
                        ? 'bg-yellow-100'
                        : 'bg-blue-100'
                  }`}
                >
                  <svg
                    className={`w-6 h-6 ${
                      escalation.severity === 'critical'
                        ? 'text-red-600'
                        : escalation.severity === 'warning'
                          ? 'text-yellow-600'
                          : 'text-blue-600'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={typeIcons[escalation.type] || typeIcons.anomaly_detected}
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-gray-900 truncate">{escalation.title}</h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[escalation.status]}`}
                      >
                        {escalation.status}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityColors[escalation.severity]}`}
                      >
                        {escalation.severity}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{typeLabels[escalation.type] || escalation.type}</span>
                    <span>&middot;</span>
                    <Link
                      href={`/campaigns/${escalation.campaignId}`}
                      className="text-blue-600 hover:underline"
                    >
                      {escalation.campaign.name}
                    </Link>
                    <span>&middot;</span>
                    <span>{escalation.campaign.playbook.business.name}</span>
                    <span>&middot;</span>
                    <span>{new Date(escalation.createdAt).toLocaleDateString()}</span>
                  </div>

                  {escalation.description && (
                    <p className="text-sm text-gray-600 mt-2">{escalation.description}</p>
                  )}

                  {/* AI Analysis - shown prominently */}
                  {escalation.aiAnalysis && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        AI Analysis
                      </p>
                      <p className="text-sm text-gray-700 mt-1">{escalation.aiAnalysis}</p>
                    </div>
                  )}

                  {/* AI Recommendation - shown prominently */}
                  {escalation.aiRecommendation && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                        Recommendation
                      </p>
                      <p className="text-sm text-blue-800 mt-1">
                        {escalation.aiRecommendation}
                      </p>
                    </div>
                  )}

                  {/* Human Response (if already provided) */}
                  {escalation.humanResponse && (
                    <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">
                        Response
                      </p>
                      <p className="text-sm text-green-800 mt-1">{escalation.humanResponse}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  {(escalation.status === 'open' || escalation.status === 'acknowledged') && (
                    <div className="flex items-center gap-2 mt-4">
                      {escalation.status === 'open' && (
                        <button
                          onClick={() => handleAction(escalation.id, 'acknowledge')}
                          disabled={actionLoading === escalation.id}
                          className="px-3 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 disabled:opacity-50"
                        >
                          {actionLoading === escalation.id ? 'Processing...' : 'Acknowledge'}
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setResponseModal({
                            id: escalation.id,
                            action: 'resolve',
                            title: escalation.title,
                          })
                        }
                        disabled={actionLoading === escalation.id}
                        className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() =>
                          setResponseModal({
                            id: escalation.id,
                            action: 'dismiss',
                            title: escalation.title,
                          })
                        }
                        disabled={actionLoading === escalation.id}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* Resolved/dismissed timestamp */}
                  {escalation.resolvedAt && (
                    <p className="text-xs text-gray-400 mt-2">
                      Resolved {new Date(escalation.resolvedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Response Modal */}
      {responseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {responseModal.action === 'resolve' ? 'Resolve' : 'Dismiss'} Escalation
            </h3>
            <p className="text-sm text-gray-500 mt-1">{responseModal.title}</p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Response (optional)
              </label>
              <textarea
                value={humanResponse}
                onChange={(e) => setHumanResponse(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder={
                  responseModal.action === 'resolve'
                    ? 'Describe how this was resolved...'
                    : 'Reason for dismissing...'
                }
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setResponseModal(null)
                  setHumanResponse('')
                }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(responseModal.id, responseModal.action)}
                disabled={actionLoading === responseModal.id}
                className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${
                  responseModal.action === 'resolve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {actionLoading === responseModal.id
                  ? 'Processing...'
                  : responseModal.action === 'resolve'
                    ? 'Resolve'
                    : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
