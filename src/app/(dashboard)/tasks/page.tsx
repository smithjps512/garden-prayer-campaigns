'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface DependsOn {
  id: string
  title: string
  status: string
}

interface Task {
  id: string
  assignee: string
  type: string
  title: string
  description: string | null
  status: string
  priority: number
  dueDate: string | null
  completedAt: string | null
  completionNotes: string | null
  createdAt: string
  campaign: {
    id: string
    name: string
    status: string
    playbook: {
      business: {
        id: string
        name: string
        slug: string
      }
    }
  }
  dependsOn: DependsOn | null
}

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  blocked: 'bg-red-100 text-red-800',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blockingTaskId, setBlockingTaskId] = useState<string | null>(null)
  const [blockReason, setBlockReason] = useState('')

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)
      const res = await fetch(`/api/tasks?${params}`)
      const data = await res.json()
      if (data.success) {
        setTasks(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

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
        await fetchTasks()
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
        await fetchTasks()
      } else {
        setError(data.error || 'Failed to block task')
      }
    } catch {
      setError('Failed to block task')
    } finally {
      setActionLoading(null)
    }
  }

  const humanTasks = tasks.filter((t) => t.assignee === 'human')
  const systemTasks = tasks.filter((t) => t.assignee === 'system')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <p className="text-gray-500 mt-1">
          Track tasks assigned to you and the system
        </p>
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

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Human Tasks */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Your Tasks</h2>
            <p className="text-sm text-gray-500">Tasks requiring human action</p>
          </div>
          {humanTasks.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p>No tasks assigned to you</p>
              <p className="text-sm text-gray-400 mt-2">
                Tasks are created when campaigns are approved
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
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
          )}
        </div>

        {/* System Tasks */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">System Tasks</h2>
            <p className="text-sm text-gray-500">Automated tasks</p>
          </div>
          {systemTasks.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p>No automated tasks</p>
              <p className="text-sm text-gray-400 mt-2">
                Tasks are created when campaigns are approved
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
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
          )}
        </div>
      </div>

      {/* Block Reason Modal */}
      {blockingTaskId && (
        <BlockReasonModal
          task={tasks.find((t) => t.id === blockingTaskId)!}
          reason={blockReason}
          loading={actionLoading === blockingTaskId}
          onReasonChange={setBlockReason}
          onConfirm={() => handleBlock(blockingTaskId)}
          onCancel={() => {
            setBlockingTaskId(null)
            setBlockReason('')
          }}
        />
      )}
    </div>
  )
}

function TaskRow({
  task,
  actionLoading,
  onComplete,
  onStartBlock,
}: {
  task: Task
  actionLoading: string | null
  onComplete: (id: string) => void
  onStartBlock: (id: string) => void
}) {
  const isActionable = task.status !== 'completed' && task.status !== 'blocked'
  const hasDependencyBlock = task.dependsOn && task.dependsOn.status !== 'completed'
  const isLoading = actionLoading === task.id

  return (
    <div className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{task.title}</h3>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[task.status]}`}
            >
              {task.status.replace('_', ' ')}
            </span>
          </div>
          {task.description && (
            <p className="text-sm text-gray-600 mt-1">{task.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <Link
              href={`/campaigns/${task.campaign.id}`}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {task.campaign.playbook.business.name} &middot; {task.campaign.name}
            </Link>
            <span className="text-xs text-gray-400">Priority: {task.priority}</span>
            {task.dueDate && (
              <span className="text-xs text-gray-400">
                Due: {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Dependency warning */}
          {hasDependencyBlock && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Blocked by: &quot;{task.dependsOn!.title}&quot; ({task.dependsOn!.status.replace('_', ' ')})
            </div>
          )}

          {/* Blocked reason */}
          {task.status === 'blocked' && task.completionNotes && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
              {task.completionNotes}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {isActionable && (
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
        )}
      </div>
    </div>
  )
}

function BlockReasonModal({
  task,
  reason,
  loading,
  onReasonChange,
  onConfirm,
  onCancel,
}: {
  task: Task
  reason: string
  loading: boolean
  onReasonChange: (reason: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Block Task</h2>
          <p className="text-sm text-gray-500 mt-1">
            Mark &quot;{task.title}&quot; as blocked
          </p>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for blocking
          </label>
          <textarea
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
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
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !reason.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Blocking...' : 'Block Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
