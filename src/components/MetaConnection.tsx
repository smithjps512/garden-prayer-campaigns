'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface MetaConnectionProps {
  businessId: string
  businessSlug: string
  metaPageId: string | null
  metaPageName: string | null
  metaIgAccountId: string | null
  metaConnectedAt: string | null // ISO string
  metaTokenExpiresAt: string | null // ISO string
}

interface MetaPageOption {
  id: string
  name: string
  category: string | null
}

export default function MetaConnection({
  businessId,
  businessSlug,
  metaPageId,
  metaPageName,
  metaIgAccountId,
  metaConnectedAt,
  metaTokenExpiresAt,
}: MetaConnectionProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [showPageSelector, setShowPageSelector] = useState(false)
  const [pages, setPages] = useState<MetaPageOption[]>([])
  const [loadingPages, setLoadingPages] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState('')

  const isConnected = !!metaPageId

  // Check if we're returning from OAuth (meta_connect=pending)
  const fetchPages = useCallback(async () => {
    setLoadingPages(true)
    setError('')
    try {
      const res = await fetch('/api/meta/pages')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load pages')
        return
      }
      setPages(data.data)
      setShowPageSelector(true)
    } catch {
      setError('Failed to load Meta pages')
    } finally {
      setLoadingPages(false)
    }
  }, [])

  useEffect(() => {
    if (searchParams.get('meta_connect') === 'pending') {
      fetchPages()
    }
    const metaError = searchParams.get('meta_error')
    if (metaError) {
      setError(decodeURIComponent(metaError))
    }
  }, [searchParams, fetchPages])

  const handleConnect = () => {
    window.location.href = `/api/meta/auth?businessId=${businessId}`
  }

  const handleSelectPage = async (pageId: string) => {
    setConnecting(true)
    setError('')
    try {
      const res = await fetch('/api/meta/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, pageId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to connect')
        return
      }
      setShowPageSelector(false)
      // Clear query params and refresh page data
      router.replace(`/businesses/${businessSlug}`)
      router.refresh()
    } catch {
      setError('Failed to connect Meta account')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect this Meta account? Scheduled posts will no longer be published.')) {
      return
    }
    setDisconnecting(true)
    setError('')
    try {
      const res = await fetch('/api/meta/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to disconnect')
        return
      }
      router.refresh()
    } catch {
      setError('Failed to disconnect Meta account')
    } finally {
      setDisconnecting(false)
    }
  }

  const connectedDate = metaConnectedAt
    ? new Date(metaConnectedAt).toLocaleDateString()
    : null
  const expiresDate = metaTokenExpiresAt
    ? new Date(metaTokenExpiresAt).toLocaleDateString()
    : null
  const isTokenExpiring = metaTokenExpiresAt
    ? new Date(metaTokenExpiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
    : false

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
        Meta Integration
      </h3>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Page Selector Modal */}
      {showPageSelector && (
        <div className="mb-4">
          <p className="text-sm text-gray-700 mb-3">
            Select a Facebook Page to connect:
          </p>
          {loadingPages ? (
            <div className="text-sm text-gray-500 py-4 text-center">
              Loading pages...
            </div>
          ) : pages.length === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center">
              <p>No pages found.</p>
              <p className="mt-1 text-xs">
                Make sure you have admin access to at least one Facebook Page.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => handleSelectPage(page.id)}
                  disabled={connecting}
                  className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {page.name}
                    </p>
                    {page.category && (
                      <p className="text-xs text-gray-500">{page.category}</p>
                    )}
                  </div>
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              ))}
            </div>
          )}
          {connecting && (
            <p className="text-sm text-blue-600 mt-2">Connecting...</p>
          )}
          <button
            onClick={() => {
              setShowPageSelector(false)
              router.replace(`/businesses/${businessSlug}`)
            }}
            className="mt-3 text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Connected State */}
      {isConnected && !showPageSelector && (
        <div>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-gray-500">Facebook Page</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                {metaPageName || metaPageId}
              </dd>
            </div>
            {metaIgAccountId && (
              <div>
                <dt className="text-sm text-gray-500">Instagram Account</dt>
                <dd className="text-sm font-medium text-gray-900 mt-0.5">
                  {metaIgAccountId}
                </dd>
              </div>
            )}
            {connectedDate && (
              <div>
                <dt className="text-sm text-gray-500">Connected</dt>
                <dd className="text-sm font-medium text-gray-900 mt-0.5">
                  {connectedDate}
                </dd>
              </div>
            )}
            {expiresDate && (
              <div>
                <dt className="text-sm text-gray-500">Token Expires</dt>
                <dd
                  className={`text-sm font-medium mt-0.5 ${
                    isTokenExpiring ? 'text-amber-600' : 'text-gray-900'
                  }`}
                >
                  {expiresDate}
                  {isTokenExpiring && ' (expiring soon)'}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-4 flex items-center space-x-3">
            <button
              onClick={handleConnect}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Reconnect
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </div>
      )}

      {/* Disconnected State */}
      {!isConnected && !showPageSelector && (
        <div className="text-center py-4">
          <svg
            className="w-10 h-10 text-gray-300 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <p className="text-sm text-gray-500 mb-3">
            Connect to post and track performance on Facebook & Instagram
          </p>
          <button
            onClick={handleConnect}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Connect to Meta
          </button>
        </div>
      )}
    </div>
  )
}
