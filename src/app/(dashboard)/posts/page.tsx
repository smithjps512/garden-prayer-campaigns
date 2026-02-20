'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// --- Types ---

interface PostContent {
  id: string
  headline: string | null
  body: string | null
  ctaText: string | null
  ctaUrl: string | null
  status: string
  type: string
  image: {
    id: string
    storageUrl: string
    thumbnailUrl: string | null
    filename: string
  } | null
  campaign: {
    id: string
    name: string
    playbook: {
      business: {
        id: string
        name: string
        slug: string
        metaPageId: string | null
        metaIgAccountId: string | null
      }
    }
  }
}

interface PostItem {
  id: string
  platform: string
  status: string
  platformPostId: string | null
  scheduledFor: string | null
  postedAt: string | null
  errorMessage: string | null
  createdAt: string
  content: PostContent
  _count: { performances: number }
}

// --- Status config ---

const postStatusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-purple-100 text-purple-700',
  posting: 'bg-blue-100 text-blue-700',
  posted: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  deleted: 'bg-gray-100 text-gray-400',
}

const platformColors: Record<string, string> = {
  facebook: 'bg-blue-50 text-blue-700',
  instagram: 'bg-purple-50 text-purple-700',
  twitter: 'bg-sky-50 text-sky-700',
}

// --- Main Page ---

export default function PostsPage() {
  const [posts, setPosts] = useState<PostItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)
      if (filterPlatform) params.append('platform', filterPlatform)
      const res = await fetch(`/api/posts?${params}`)
      const data = await res.json()
      if (data.success) {
        setPosts(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterPlatform])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  async function handleRetry(postId: string) {
    setActionLoading(postId)
    setError(null)
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchPosts()
      } else {
        setError(data.error || 'Failed to retry post')
      }
    } catch {
      setError('Failed to retry post')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancel(postId: string) {
    if (!confirm('Cancel this scheduled post?')) return
    setActionLoading(postId)
    setError(null)
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchPosts()
      } else {
        setError(data.error || 'Failed to cancel post')
      }
    } catch {
      setError('Failed to cancel post')
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

  // Summary stats
  const stats = {
    total: posts.length,
    posted: posts.filter((p) => p.status === 'posted').length,
    scheduled: posts.filter((p) => p.status === 'scheduled').length,
    failed: posts.filter((p) => p.status === 'failed').length,
  }

  // Filter out deleted unless explicitly filtered
  const visiblePosts = filterStatus === 'deleted'
    ? posts
    : posts.filter((p) => p.status !== 'deleted')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Posts</h1>
        <p className="text-gray-500 mt-1">
          Track and manage posts across Facebook and Instagram
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

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-500">Total Posts</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.posted}</p>
          <p className="text-sm text-gray-500">Published</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{stats.scheduled}</p>
          <p className="text-sm text-gray-500">Scheduled</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
          <p className="text-sm text-gray-500">Failed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="posting">Posting</option>
          <option value="posted">Posted</option>
          <option value="failed">Failed</option>
          <option value="deleted">Cancelled</option>
        </select>
        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Platforms</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
        </select>
      </div>

      {/* Posts list */}
      {visiblePosts.length === 0 ? (
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
              d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No posts yet</h3>
          <p className="mt-2 text-gray-500">
            Approve content and use the Post button to publish to social media
          </p>
          <Link
            href="/content"
            className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Content Library
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              actionLoading={actionLoading}
              onRetry={() => handleRetry(post.id)}
              onCancel={() => handleCancel(post.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// --- Post Card ---

function PostCard({
  post,
  actionLoading,
  onRetry,
  onCancel,
}: {
  post: PostItem
  actionLoading: string | null
  onRetry: () => void
  onCancel: () => void
}) {
  const isLoading = actionLoading === post.id
  const content = post.content

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${postStatusColors[post.status]}`}>
              {post.status}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${platformColors[post.platform] || 'bg-gray-100 text-gray-700'}`}>
              {post.platform === 'facebook' ? 'Facebook' : post.platform === 'instagram' ? 'Instagram' : post.platform}
            </span>
            <span className="text-xs text-gray-400 capitalize">{content.type.replace('_', ' ')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/campaigns/${content.campaign.id}`}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {content.campaign.name}
            </Link>
            <span className="text-xs text-gray-300">|</span>
            <span className="text-xs text-gray-400">{content.campaign.playbook.business.name}</span>
          </div>
        </div>

        {/* Content preview */}
        <div className="flex items-start gap-4">
          {content.image && (
            <div className="flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={content.image.thumbnailUrl || content.image.storageUrl}
                alt=""
                className="w-16 h-16 rounded-lg object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {content.headline && (
              <h3 className="font-semibold text-gray-900 mb-1 truncate">{content.headline}</h3>
            )}
            {content.body && (
              <p className="text-sm text-gray-600 line-clamp-2">{content.body}</p>
            )}
            {content.ctaText && (
              <p className="text-sm text-blue-600 mt-1 font-medium">{content.ctaText}</p>
            )}
          </div>
        </div>

        {/* Error message for failed posts */}
        {post.status === 'failed' && post.errorMessage && (
          <div className="mt-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <p className="text-xs text-red-700">{post.errorMessage}</p>
          </div>
        )}

        {/* Footer: timestamps + actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            {post.postedAt && (
              <span className="text-xs text-gray-500">
                Posted {new Date(post.postedAt).toLocaleString()}
              </span>
            )}
            {post.scheduledFor && post.status === 'scheduled' && (
              <span className="text-xs text-purple-600">
                Scheduled for {new Date(post.scheduledFor).toLocaleString()}
              </span>
            )}
            {!post.postedAt && post.status !== 'scheduled' && (
              <span className="text-xs text-gray-400">
                Created {new Date(post.createdAt).toLocaleString()}
              </span>
            )}
            {post._count.performances > 0 && (
              <span className="text-xs text-gray-500">
                {post._count.performances} performance records
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {post.status === 'posted' && post.platformPostId && (
              <a
                href={
                  post.platform === 'facebook'
                    ? `https://www.facebook.com/${post.platformPostId}`
                    : `https://www.instagram.com/p/${post.platformPostId}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View on {post.platform === 'facebook' ? 'Facebook' : 'Instagram'}
              </a>
            )}
            {post.status === 'failed' && (
              <button
                onClick={onRetry}
                disabled={isLoading || actionLoading !== null}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Retrying...' : 'Retry'}
              </button>
            )}
            {post.status === 'scheduled' && (
              <button
                onClick={onCancel}
                disabled={isLoading || actionLoading !== null}
                className="px-3 py-1.5 text-xs font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
