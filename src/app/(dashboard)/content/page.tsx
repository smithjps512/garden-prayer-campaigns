'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// --- Types ---

interface Campaign {
  id: string
  name: string
  status: string
}

interface ContentImage {
  id: string
  filename: string
  storageUrl: string
  thumbnailUrl: string | null
}

interface ContentItem {
  id: string
  type: string
  status: string
  headline: string | null
  body: string | null
  ctaText: string | null
  ctaUrl: string | null
  hookSource: string | null
  audienceSegment: string | null
  performanceScore: number | null
  createdAt: string
  updatedAt: string
  campaign: Campaign
  image: ContentImage | null
  _count: { posts: number }
}

// --- Status config ---

const statusColors: Record<string, string> = {
  generated: 'bg-gray-100 text-gray-800',
  approved: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-purple-100 text-purple-800',
  posted: 'bg-green-100 text-green-800',
  paused: 'bg-orange-100 text-orange-800',
  retired: 'bg-red-100 text-red-800',
}

// --- Main Page ---

export default function ContentPage() {
  const [content, setContent] = useState<ContentItem[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCampaign, setFilterCampaign] = useState('')

  // Generation state
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateProgress, setGenerateProgress] = useState('')
  const [lastGeneratedCount, setLastGeneratedCount] = useState(0)

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchContent = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)
      if (filterCampaign) params.append('campaignId', filterCampaign)
      const res = await fetch(`/api/content?${params}`)
      const data = await res.json()
      if (data.success) {
        setContent(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch content:', err)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterCampaign])

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/campaigns')
      const data = await res.json()
      if (data.success) {
        setCampaigns(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err)
    }
  }, [])

  useEffect(() => {
    fetchContent()
    fetchCampaigns()
  }, [fetchContent, fetchCampaigns])

  async function handleGenerate(opts: {
    campaignId: string
    count: number
    contentType: string
    platform: string
  }) {
    setGenerating(true)
    setGenerateProgress(`Generating ${opts.count} content pieces... This may take 15-30 seconds.`)
    setError(null)
    try {
      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      })
      const data = await res.json()
      if (data.success) {
        const count = data.data.content?.length || 0
        setLastGeneratedCount(count)
        setGenerateProgress(`Generated ${count} content pieces!`)
        setShowGenerateModal(false)
        // Set filter to show the generated campaign's content
        setFilterCampaign(opts.campaignId)
        await fetchContent()
      } else {
        setError(data.error || 'Failed to generate content')
        setGenerateProgress('')
      }
    } catch {
      setError('Failed to generate content. Check that the Claude API key is configured.')
      setGenerateProgress('')
    } finally {
      setGenerating(false)
    }
  }

  async function handleStatusChange(contentId: string, newStatus: string) {
    setActionLoading(contentId)
    setError(null)
    try {
      const res = await fetch(`/api/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchContent()
      } else {
        setError(data.error || `Failed to ${newStatus} content`)
      }
    } catch {
      setError(`Failed to ${newStatus} content`)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSaveEdit(contentId: string, updates: {
    headline?: string
    body?: string
    ctaText?: string
  }) {
    setActionLoading(contentId)
    setError(null)
    try {
      const res = await fetch(`/api/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      if (data.success) {
        setEditingId(null)
        await fetchContent()
      } else {
        setError(data.error || 'Failed to save changes')
      }
    } catch {
      setError('Failed to save changes')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(contentId: string) {
    if (!confirm('Delete this content piece?')) return
    setActionLoading(contentId)
    setError(null)
    try {
      const res = await fetch(`/api/content/${contentId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        await fetchContent()
      } else {
        setError(data.error || 'Failed to delete content')
      }
    } catch {
      setError('Failed to delete content')
    } finally {
      setActionLoading(null)
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
          <h1 className="text-2xl font-bold text-gray-900">Content Library</h1>
          <p className="text-gray-500 mt-1">
            Generate, review, and manage campaign content
          </p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          disabled={generating}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {generating ? 'Generating...' : '+ Generate Content'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Generation progress banner */}
      {generateProgress && (
        <div className={`px-4 py-3 rounded-lg flex items-center gap-3 ${
          generating
            ? 'bg-blue-50 border border-blue-200 text-blue-700'
            : 'bg-green-50 border border-green-200 text-green-700'
        }`}>
          {generating && (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
          )}
          {!generating && (
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span className="font-medium">{generateProgress}</span>
          {!generating && lastGeneratedCount > 0 && (
            <button
              onClick={() => { setGenerateProgress(''); setLastGeneratedCount(0) }}
              className="ml-auto text-sm underline"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Statuses</option>
          <option value="generated">Generated</option>
          <option value="approved">Approved</option>
          <option value="scheduled">Scheduled</option>
          <option value="posted">Posted</option>
          <option value="paused">Paused</option>
          <option value="retired">Retired</option>
        </select>
        <select
          value={filterCampaign}
          onChange={(e) => setFilterCampaign(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Content list */}
      {content.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No content yet</h3>
          <p className="mt-2 text-gray-500">
            Generate content from your campaigns using AI
          </p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Generate Content
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {content.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              isEditing={editingId === item.id}
              actionLoading={actionLoading}
              onStartEdit={() => setEditingId(item.id)}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={(updates) => handleSaveEdit(item.id, updates)}
              onStatusChange={(status) => handleStatusChange(item.id, status)}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      )}

      {/* Generate Modal */}
      {showGenerateModal && (
        <GenerateModal
          campaigns={campaigns}
          generating={generating}
          onGenerate={handleGenerate}
          onClose={() => setShowGenerateModal(false)}
        />
      )}
    </div>
  )
}

// --- Content Card ---

function ContentCard({
  item,
  isEditing,
  actionLoading,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onStatusChange,
  onDelete,
}: {
  item: ContentItem
  isEditing: boolean
  actionLoading: string | null
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: (updates: { headline?: string; body?: string; ctaText?: string }) => void
  onStatusChange: (status: string) => void
  onDelete: () => void
}) {
  const isLoading = actionLoading === item.id
  const canEdit = item.status === 'generated' || item.status === 'approved'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[item.status]}`}>
              {item.status}
            </span>
            <span className="text-xs text-gray-400 capitalize">{item.type.replace('_', ' ')}</span>
            {item.audienceSegment && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {item.audienceSegment}
              </span>
            )}
            {item.hookSource && (
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                Hook: {item.hookSource}
              </span>
            )}
          </div>
          <Link
            href={`/campaigns/${item.campaign.id}`}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {item.campaign.name}
          </Link>
        </div>

        {/* Content body — editable or display */}
        {isEditing ? (
          <EditForm
            headline={item.headline || ''}
            body={item.body || ''}
            ctaText={item.ctaText || ''}
            isLoading={isLoading}
            onCancel={onCancelEdit}
            onSave={onSaveEdit}
          />
        ) : (
          <div>
            {item.headline && (
              <h3 className="font-semibold text-gray-900 mb-1">{item.headline}</h3>
            )}
            {item.body && (
              <p className="text-sm text-gray-600 whitespace-pre-line">{item.body}</p>
            )}
            {item.ctaText && (
              <p className="text-sm text-blue-600 mt-2 font-medium">{item.ctaText}</p>
            )}
          </div>
        )}

        {/* Footer: actions + metadata */}
        {!isEditing && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {new Date(item.createdAt).toLocaleDateString()}
              </span>
              {item.performanceScore !== null && (
                <span className="text-xs text-gray-500">Score: {item.performanceScore}</span>
              )}
              {item._count.posts > 0 && (
                <span className="text-xs text-gray-500">{item._count.posts} posts</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Edit button */}
              {canEdit && (
                <button
                  onClick={onStartEdit}
                  disabled={isLoading || actionLoading !== null}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Edit
                </button>
              )}

              {/* Status actions */}
              {item.status === 'generated' && (
                <button
                  onClick={() => onStatusChange('approved')}
                  disabled={isLoading || actionLoading !== null}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? 'Approving...' : 'Approve'}
                </button>
              )}
              {item.status === 'approved' && (
                <button
                  onClick={() => onStatusChange('generated')}
                  disabled={isLoading || actionLoading !== null}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Unapprove
                </button>
              )}
              {(item.status === 'generated' || item.status === 'approved') && (
                <button
                  onClick={() => onStatusChange('retired')}
                  disabled={isLoading || actionLoading !== null}
                  className="px-3 py-1.5 text-xs font-medium border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 disabled:opacity-50 transition-colors"
                >
                  Retire
                </button>
              )}
              {item.status === 'retired' && (
                <button
                  onClick={() => onStatusChange('generated')}
                  disabled={isLoading || actionLoading !== null}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Restore
                </button>
              )}

              {/* Delete */}
              {item.status !== 'posted' && (
                <button
                  onClick={onDelete}
                  disabled={isLoading || actionLoading !== null}
                  className="px-3 py-1.5 text-xs font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Separate component so state initializes fresh each time edit mode is entered
function EditForm({
  headline,
  body,
  ctaText,
  isLoading,
  onCancel,
  onSave,
}: {
  headline: string
  body: string
  ctaText: string
  isLoading: boolean
  onCancel: () => void
  onSave: (updates: { headline?: string; body?: string; ctaText?: string }) => void
}) {
  const [editHeadline, setEditHeadline] = useState(headline)
  const [editBody, setEditBody] = useState(body)
  const [editCta, setEditCta] = useState(ctaText)

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Headline</label>
        <input
          type="text"
          value={editHeadline}
          onChange={(e) => setEditHeadline(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Body</label>
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">CTA Text</label>
        <input
          type="text"
          value={editCta}
          onChange={(e) => setEditCta(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave({
            headline: editHeadline,
            body: editBody,
            ctaText: editCta,
          })}
          disabled={isLoading}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// --- Generate Modal ---

function GenerateModal({
  campaigns,
  generating,
  onGenerate,
  onClose,
}: {
  campaigns: Campaign[]
  generating: boolean
  onGenerate: (opts: {
    campaignId: string
    count: number
    contentType: string
    platform: string
  }) => void
  onClose: () => void
}) {
  // Only show campaigns that are eligible (have playbooks)
  const eligibleCampaigns = campaigns.filter(
    (c) => c.status !== 'completed' && c.status !== 'failed'
  )

  const [campaignId, setCampaignId] = useState(eligibleCampaigns[0]?.id || '')
  const [count, setCount] = useState(5)
  const [contentType, setContentType] = useState('organic_post')
  const [platform, setPlatform] = useState('both')
  const [formError, setFormError] = useState('')

  function handleSubmit() {
    if (!campaignId) {
      setFormError('Please select a campaign')
      return
    }
    if (count < 1 || count > 20) {
      setFormError('Count must be between 1 and 20')
      return
    }
    onGenerate({ campaignId, count, contentType, platform })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full m-4">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Generate Content</h2>
            <button onClick={onClose} disabled={generating} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            AI generates content using your playbook&apos;s hooks, audiences, and positioning
          </p>
        </div>

        <div className="p-6 space-y-4">
          {formError && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{formError}</div>
          )}

          {eligibleCampaigns.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500">No eligible campaigns. Create a campaign first.</p>
              <Link href="/campaigns" className="text-blue-600 hover:underline mt-2 block">
                Go to Campaigns
              </Link>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign</label>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  disabled={generating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                >
                  {eligibleCampaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Pieces
                </label>
                <input
                  type="number"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                  min={1}
                  max={20}
                  disabled={generating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                />
                <p className="text-xs text-gray-400 mt-1">1-20 pieces. More pieces take longer to generate.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  disabled={generating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                >
                  <option value="organic_post">Organic Post</option>
                  <option value="ad">Ad</option>
                  <option value="story">Story</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                <div className="flex gap-3">
                  {['both', 'facebook', 'instagram'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlatform(p)}
                      disabled={generating}
                      className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors disabled:opacity-50 ${
                        platform === p
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {p === 'both' ? 'Both' : p}
                    </button>
                  ))}
                </div>
              </div>

              {generating && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        Generating {count} content pieces...
                      </p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        Claude is writing platform-optimized content from your playbook. This typically takes 15-30 seconds.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={generating || eligibleCampaigns.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {generating ? 'Generating...' : 'Generate Content'}
          </button>
        </div>
      </div>
    </div>
  )
}
