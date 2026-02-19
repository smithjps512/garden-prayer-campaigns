'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

// --- Types ---

interface Business {
  id: string
  name: string
  slug: string
  brandColors: Record<string, string> | null
}

interface PlaybookSummary {
  id: string
  name: string
  positioning: string | null
  audiences: unknown[] | null
  hooks: unknown[] | null
  business: Business
}

interface ContentItem {
  id: string
  type: string
  status: string
  headline: string | null
  body: string | null
  ctaText: string | null
  hookSource: string | null
  audienceSegment: string | null
  performanceScore: number | null
  createdAt: string
  image: { id: string; storageUrl: string; thumbnailUrl: string | null } | null
}

interface TaskItem {
  id: string
  assignee: string
  type: string
  title: string
  status: string
  priority: number
  dueDate: string | null
}

interface EscalationItem {
  id: string
  type: string
  severity: string
  title: string
  status: string
  createdAt: string
}

interface Campaign {
  id: string
  name: string
  status: string
  targetAudience: string | null
  targetMarkets: string[] | null
  channels: string[] | null
  budgetDaily: number | null
  budgetTotal: number | null
  startDate: string | null
  endDate: string | null
  successMetrics: Record<string, unknown> | null
  autoOptimize: boolean
  approvedAt: string | null
  approvedBy: string | null
  createdAt: string
  updatedAt: string
  playbook: PlaybookSummary
  contents: ContentItem[]
  tasks: TaskItem[]
  escalations: EscalationItem[]
  _count: {
    contents: number
    tasks: number
    escalations: number
  }
}

// --- Status config ---

const STATUS_ORDER = ['draft', 'review', 'approved', 'setup', 'live', 'paused', 'completed', 'failed']

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

const taskStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
}

const contentStatusColors: Record<string, string> = {
  generated: 'bg-gray-100 text-gray-700',
  approved: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-purple-100 text-purple-700',
  posted: 'bg-green-100 text-green-700',
  paused: 'bg-orange-100 text-orange-700',
  retired: 'bg-red-100 text-red-700',
}

const severityColors: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700',
}

// --- Component ---

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'content' | 'escalations'>('overview')

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}`)
      const data = await res.json()
      if (data.success) {
        setCampaign(data.data)
      } else {
        setError(data.error || 'Failed to load campaign')
      }
    } catch {
      setError('Failed to load campaign')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  async function performAction(action: string, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return

    setActionLoading(action)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${id}/${action}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        await fetchCampaign()
      } else {
        setError(data.error || `Failed to ${action} campaign`)
      }
    } catch {
      setError(`Failed to ${action} campaign`)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this campaign? This cannot be undone.')) return

    setActionLoading('delete')
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        router.push('/campaigns')
      } else {
        setError(data.error || 'Failed to delete campaign')
      }
    } catch {
      setError('Failed to delete campaign')
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

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Campaign not found</h2>
        {error && <p className="text-red-600 mt-2">{error}</p>}
        <Link href="/campaigns" className="text-blue-600 hover:underline mt-2 block">
          Back to Campaigns
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/campaigns" className="hover:text-gray-700">Campaigns</Link>
            <span>/</span>
            <span>{campaign.playbook.business.name}</span>
            <span>/</span>
            <span className="text-gray-700">{campaign.playbook.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[campaign.status]}`}>
              {campaign.status}
            </span>
            {campaign.targetAudience && (
              <span className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                {campaign.targetAudience}
              </span>
            )}
            {campaign.autoOptimize && (
              <span className="text-xs text-gray-500">Auto-optimize on</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {(campaign.status === 'draft' || campaign.status === 'review') && (
            <button
              onClick={() => performAction('approve')}
              disabled={actionLoading !== null}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'approve' ? 'Approving...' : 'Approve'}
            </button>
          )}
          {(campaign.status === 'approved' || campaign.status === 'setup') && (
            <button
              onClick={() => performAction('launch', 'Launch this campaign? Ensure all tasks are complete.')}
              disabled={actionLoading !== null}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'launch' ? 'Launching...' : 'Launch'}
            </button>
          )}
          {campaign.status === 'live' && (
            <button
              onClick={() => performAction('pause', 'Pause this campaign?')}
              disabled={actionLoading !== null}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'pause' ? 'Pausing...' : 'Pause'}
            </button>
          )}
          {campaign.status === 'paused' && (
            <button
              onClick={() => performAction('resume')}
              disabled={actionLoading !== null}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'resume' ? 'Resuming...' : 'Resume'}
            </button>
          )}
          {(campaign.status === 'live' || campaign.status === 'paused') && (
            <button
              onClick={() => performAction('complete', 'Mark this campaign as completed?')}
              disabled={actionLoading !== null}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'complete' ? 'Completing...' : 'Complete'}
            </button>
          )}
          {campaign.status !== 'live' && (
            <button
              onClick={handleDelete}
              disabled={actionLoading !== null}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'delete' ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      {/* Status workflow indicator */}
      <StatusWorkflow currentStatus={campaign.status} />

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {([
            { key: 'overview', label: 'Overview' },
            { key: 'tasks', label: `Tasks (${campaign._count.tasks})` },
            { key: 'content', label: `Content (${campaign._count.contents})` },
            { key: 'escalations', label: `Escalations (${campaign._count.escalations})` },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab campaign={campaign} />}
      {activeTab === 'tasks' && <TasksTab tasks={campaign.tasks} onRefresh={fetchCampaign} />}
      {activeTab === 'content' && <ContentTab contents={campaign.contents} />}
      {activeTab === 'escalations' && <EscalationsTab escalations={campaign.escalations} />}
    </div>
  )
}

// --- Status Workflow ---

function StatusWorkflow({ currentStatus }: { currentStatus: string }) {
  const mainFlow = ['draft', 'approved', 'live', 'completed']
  const currentIdx = STATUS_ORDER.indexOf(currentStatus)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        {mainFlow.map((status, i) => {
          const statusIdx = STATUS_ORDER.indexOf(status)
          const isActive = currentStatus === status
          const isPast = currentIdx > statusIdx && currentStatus !== 'failed'
          const isFuture = !isActive && !isPast

          return (
            <div key={status} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isPast
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isPast ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-xs mt-1 capitalize ${
                    isActive ? 'text-blue-600 font-medium' : isFuture ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  {status}
                </span>
              </div>
              {i < mainFlow.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    isPast ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
      {(currentStatus === 'paused' || currentStatus === 'failed' || currentStatus === 'review' || currentStatus === 'setup') && (
        <div className="mt-3 text-center">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[currentStatus]}`}>
            Currently: {currentStatus}
          </span>
        </div>
      )}
    </div>
  )
}

// --- Overview Tab ---

function OverviewTab({ campaign }: { campaign: Campaign }) {
  const channels = campaign.channels as string[] | null
  const createdAt = new Date(campaign.createdAt).toLocaleDateString()
  const updatedAt = new Date(campaign.updatedAt).toLocaleDateString()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Campaign Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Campaign Details</h3>

        <div className="grid grid-cols-2 gap-4">
          <Detail label="Target Audience" value={campaign.targetAudience} />
          <Detail
            label="Channels"
            value={channels && channels.length > 0 ? channels.join(', ') : null}
          />
          <Detail
            label="Daily Budget"
            value={campaign.budgetDaily ? `$${campaign.budgetDaily}` : null}
          />
          <Detail
            label="Total Budget"
            value={campaign.budgetTotal ? `$${campaign.budgetTotal}` : null}
          />
          <Detail
            label="Start Date"
            value={campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : null}
          />
          <Detail
            label="End Date"
            value={campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : 'Runs until stopped'}
          />
          <Detail label="Created" value={createdAt} />
          <Detail label="Last Updated" value={updatedAt} />
        </div>

        {campaign.approvedAt && (
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Approved {new Date(campaign.approvedAt).toLocaleDateString()} by {campaign.approvedBy}
            </p>
          </div>
        )}
      </div>

      {/* Playbook Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Playbook</h3>
          <Link
            href={`/playbooks/${campaign.playbook.id}`}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            View Playbook
          </Link>
        </div>

        <div>
          <p className="font-medium text-gray-800">{campaign.playbook.name}</p>
          <p className="text-sm text-gray-500 mt-1">{campaign.playbook.business.name}</p>
        </div>

        {campaign.playbook.positioning && (
          <div>
            <p className="text-sm font-medium text-gray-600">Positioning</p>
            <p className="text-sm text-gray-500 mt-1 line-clamp-3">{campaign.playbook.positioning}</p>
          </div>
        )}
      </div>

      {/* Success Metrics */}
      {campaign.successMetrics && Object.keys(campaign.successMetrics).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Success Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(campaign.successMetrics).map(([key, value]) => (
              <div key={key}>
                <p className="text-sm text-gray-500 capitalize">{key.replace(/_/g, ' ')}</p>
                <p className="text-lg font-semibold text-gray-900">{String(value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Counts */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <button
            onClick={() => document.querySelector<HTMLButtonElement>('[data-tab="tasks"]')?.click()}
            className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <p className="text-2xl font-bold text-gray-900">{campaign._count.tasks}</p>
            <p className="text-sm text-gray-500">Tasks</p>
          </button>
          <button
            onClick={() => document.querySelector<HTMLButtonElement>('[data-tab="content"]')?.click()}
            className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <p className="text-2xl font-bold text-gray-900">{campaign._count.contents}</p>
            <p className="text-sm text-gray-500">Content</p>
          </button>
          <button
            onClick={() => document.querySelector<HTMLButtonElement>('[data-tab="escalations"]')?.click()}
            className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <p className="text-2xl font-bold text-gray-900">{campaign._count.escalations}</p>
            <p className="text-sm text-gray-500">Escalations</p>
          </button>
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
    </div>
  )
}

// --- Tasks Tab ---

function TasksTab({ tasks, onRefresh }: { tasks: TaskItem[]; onRefresh: () => Promise<void> }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blockingTaskId, setBlockingTaskId] = useState<string | null>(null)
  const [blockReason, setBlockReason] = useState('')

  async function handleComplete(taskId: string) {
    setActionLoading(taskId)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) {
        await onRefresh()
      } else {
        setError(data.error || 'Failed to complete task')
      }
    } catch {
      setError('Failed to complete task')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleBlock(taskId: string) {
    if (!blockReason.trim()) {
      setError('Please provide a reason for blocking this task')
      return
    }
    setActionLoading(taskId)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${taskId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: blockReason.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setBlockingTaskId(null)
        setBlockReason('')
        await onRefresh()
      } else {
        setError(data.error || 'Failed to block task')
      }
    } catch {
      setError('Failed to block task')
    } finally {
      setActionLoading(null)
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No tasks yet. Tasks are created when a campaign is approved.</p>
      </div>
    )
  }

  const humanTasks = tasks.filter((t) => t.assignee === 'human')
  const systemTasks = tasks.filter((t) => t.assignee === 'system')

  return (
    <div className="space-y-6">
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

      {humanTasks.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Human Tasks</h3>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {humanTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                actionLoading={actionLoading}
                onComplete={handleComplete}
                onStartBlock={setBlockingTaskId}
              />
            ))}
          </div>
        </div>
      )}

      {systemTasks.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">System Tasks</h3>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {systemTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                actionLoading={actionLoading}
                onComplete={handleComplete}
                onStartBlock={setBlockingTaskId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Block Reason Modal */}
      {blockingTaskId && (() => {
        const blockTask = tasks.find((t) => t.id === blockingTaskId)
        return blockTask ? (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Block Task</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Mark &quot;{blockTask.title}&quot; as blocked
                </p>
              </div>
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for blocking
                </label>
                <textarea
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  rows={3}
                  placeholder="Describe why this task is blocked..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-2">
                  This will create an escalation for the blocked task.
                </p>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => { setBlockingTaskId(null); setBlockReason('') }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleBlock(blockingTaskId)}
                  disabled={actionLoading === blockingTaskId || !blockReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === blockingTaskId ? 'Blocking...' : 'Block Task'}
                </button>
              </div>
            </div>
          </div>
        ) : null
      })()}
    </div>
  )
}

function TaskRow({
  task,
  actionLoading,
  onComplete,
  onStartBlock,
}: {
  task: TaskItem
  actionLoading: string | null
  onComplete: (id: string) => void
  onStartBlock: (id: string) => void
}) {
  const isActionable = task.status !== 'completed' && task.status !== 'blocked'
  const isLoading = actionLoading === task.id

  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            task.status === 'completed'
              ? 'bg-green-500'
              : task.status === 'blocked'
                ? 'bg-red-500'
                : task.status === 'in_progress'
                  ? 'bg-blue-500'
                  : 'bg-gray-300'
          }`}
        />
        <div>
          <p className="text-sm font-medium text-gray-900">{task.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${taskStatusColors[task.status]}`}>
              {task.status.replace('_', ' ')}
            </span>
            <span className="text-xs text-gray-400">Priority: {task.priority}</span>
            {task.dueDate && (
              <span className="text-xs text-gray-400">
                Due: {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
      {isActionable ? (
        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          <button
            onClick={() => onComplete(task.id)}
            disabled={isLoading || actionLoading !== null}
            className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Completing...' : 'Complete'}
          </button>
          <button
            onClick={() => onStartBlock(task.id)}
            disabled={isLoading || actionLoading !== null}
            className="px-3 py-1.5 text-xs font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            Block
          </button>
        </div>
      ) : (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${taskStatusColors[task.status]}`}>
          {task.status === 'completed' ? 'Done' : task.status.replace('_', ' ')}
        </span>
      )}
    </div>
  )
}

// --- Content Tab ---

function ContentTab({ contents }: { contents: ContentItem[] }) {
  if (contents.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No content generated yet.</p>
        <Link href="/content" className="text-blue-600 hover:underline mt-2 inline-block text-sm">
          Go to Content Library
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {contents.map((content) => (
        <div key={content.id} className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${contentStatusColors[content.status]}`}>
                  {content.status}
                </span>
                <span className="text-xs text-gray-400 capitalize">{content.type.replace('_', ' ')}</span>
                {content.audienceSegment && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {content.audienceSegment}
                  </span>
                )}
                {content.hookSource && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                    Hook: {content.hookSource}
                  </span>
                )}
              </div>
              {content.headline && (
                <h4 className="font-medium text-gray-900 mb-1">{content.headline}</h4>
              )}
              {content.body && (
                <p className="text-sm text-gray-600 line-clamp-3">{content.body}</p>
              )}
              {content.ctaText && (
                <p className="text-sm text-blue-600 mt-2 font-medium">{content.ctaText}</p>
              )}
            </div>
            {content.image && (
              <Image
                src={content.image.thumbnailUrl || content.image.storageUrl}
                alt=""
                width={64}
                height={64}
                className="rounded-lg object-cover ml-4 flex-shrink-0"
                unoptimized
              />
            )}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              {new Date(content.createdAt).toLocaleDateString()}
            </span>
            {content.performanceScore !== null && (
              <span className="text-xs text-gray-500">
                Score: {content.performanceScore}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// --- Escalations Tab ---

function EscalationsTab({ escalations }: { escalations: EscalationItem[] }) {
  if (escalations.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No open escalations.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {escalations.map((esc) => (
        <div key={esc.id} className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[esc.severity]}`}>
                  {esc.severity}
                </span>
                <span className="text-xs text-gray-400 capitalize">{esc.type.replace(/_/g, ' ')}</span>
              </div>
              <h4 className="font-medium text-gray-900">{esc.title}</h4>
            </div>
            <Link
              href="/escalations"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Opened {new Date(esc.createdAt).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  )
}
