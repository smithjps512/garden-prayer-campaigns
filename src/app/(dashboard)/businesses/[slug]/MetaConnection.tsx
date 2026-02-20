'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface MetaConnectionProps {
  businessId: string
  businessSlug: string
  metaPageId: string | null
  metaPageName: string | null
  metaIgAccountId: string | null
  metaConnectedAt: string | null
  metaTokenExpiresAt: string | null
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
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConnected = !!metaPageId

  async function handleDisconnect() {
    if (!confirm('Disconnect from Meta? This will remove the stored page token. You can reconnect later.')) {
      return
    }

    setDisconnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/meta/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      })
      const data = await res.json()
      if (data.success) {
        router.refresh()
      } else {
        setError(data.error || 'Failed to disconnect')
      }
    } catch {
      setError('Failed to disconnect from Meta')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
        Meta Integration
      </h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {isConnected ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm font-medium text-green-700">Connected</span>
          </div>

          <dl className="space-y-3">
            {metaPageName && (
              <div>
                <dt className="text-sm text-gray-500">Facebook Page</dt>
                <dd className="text-sm font-medium text-gray-900 mt-0.5">
                  {metaPageName}
                </dd>
              </div>
            )}
            {metaPageId && (
              <div>
                <dt className="text-sm text-gray-500">Page ID</dt>
                <dd className="text-sm font-mono text-gray-600 mt-0.5 text-xs">
                  {metaPageId}
                </dd>
              </div>
            )}
            {metaIgAccountId && (
              <div>
                <dt className="text-sm text-gray-500">Instagram Account</dt>
                <dd className="text-sm font-mono text-gray-600 mt-0.5 text-xs">
                  {metaIgAccountId}
                </dd>
              </div>
            )}
            {!metaIgAccountId && (
              <div>
                <dt className="text-sm text-gray-500">Instagram</dt>
                <dd className="text-sm text-gray-400 mt-0.5">
                  Not linked to this page
                </dd>
              </div>
            )}
            {metaConnectedAt && (
              <div>
                <dt className="text-sm text-gray-500">Connected</dt>
                <dd className="text-sm text-gray-600 mt-0.5">{metaConnectedAt}</dd>
              </div>
            )}
            {metaTokenExpiresAt && (
              <div>
                <dt className="text-sm text-gray-500">Token Expires</dt>
                <dd className="text-sm text-gray-600 mt-0.5">{metaTokenExpiresAt}</dd>
              </div>
            )}
          </dl>

          <div className="pt-3 border-t border-gray-100 flex gap-2">
            <a
              href={`/api/meta/auth?businessId=${businessId}`}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Reconnect
            </a>
            <span className="text-gray-300">|</span>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <svg className="mx-auto h-10 w-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <p className="text-sm text-gray-500 mb-3">Not connected to Meta</p>
          <a
            href={`/api/meta/auth?businessId=${businessId}`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Connect to Meta
          </a>
          <p className="text-xs text-gray-400 mt-2">
            Links your Facebook Page and Instagram account for posting
          </p>
        </div>
      )}
    </div>
  )
}
