'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Audience {
  name: string
  description: string
  painPoints: string[]
  desires: string[]
  objections?: string[]
}

interface Hook {
  id: string
  text: string
  angle: string
  targetAudience?: string
}

interface Playbook {
  id: string
  name: string
  status: 'draft' | 'active' | 'archived'
  version: number
  positioning: string | null
  founderStory: string | null
  audiences: Audience[] | null
  hooks: Hook[] | null
  keyMessages: Record<string, string[]> | null
  objectionHandlers: Record<string, string> | null
  createdAt: string
  updatedAt: string
  business: {
    id: string
    name: string
    slug: string
    brandColors: Record<string, string> | null
  }
  campaigns: Array<{
    id: string
    name: string
    status: string
  }>
  _count: {
    campaigns: number
  }
}

export default function PlaybookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [playbook, setPlaybook] = useState<Playbook | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'audiences' | 'hooks' | 'messages'>('overview')
  const [editMode, setEditMode] = useState(false)

  // Editable fields
  const [name, setName] = useState('')
  const [positioning, setPositioning] = useState('')
  const [founderStory, setFounderStory] = useState('')

  useEffect(() => {
    fetchPlaybook()
  }, [id])

  async function fetchPlaybook() {
    try {
      const res = await fetch(`/api/playbooks/${id}`)
      const data = await res.json()
      if (data.success) {
        setPlaybook(data.data)
        setName(data.data.name)
        setPositioning(data.data.positioning || '')
        setFounderStory(data.data.founderStory || '')
      }
    } catch (error) {
      console.error('Failed to fetch playbook:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/playbooks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, positioning, founderStory }),
      })
      const data = await res.json()
      if (data.success) {
        setPlaybook(data.data)
        setEditMode(false)
      }
    } catch (error) {
      console.error('Failed to save playbook:', error)
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate() {
    try {
      const res = await fetch(`/api/playbooks/${id}/activate`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setPlaybook(data.data)
      } else {
        alert(data.error || 'Failed to activate playbook')
      }
    } catch (error) {
      console.error('Failed to activate playbook:', error)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this playbook?')) return

    try {
      const res = await fetch(`/api/playbooks/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        router.push('/playbooks')
      } else {
        alert(data.error || 'Failed to delete playbook')
      }
    } catch (error) {
      console.error('Failed to delete playbook:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!playbook) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Playbook not found</h2>
        <Link href="/playbooks" className="text-blue-600 hover:underline mt-2 block">
          Back to Playbooks
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/playbooks" className="hover:text-gray-700">
              Playbooks
            </Link>
            <span>/</span>
            <span>{playbook.business.name}</span>
          </div>
          {editMode ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-2xl font-bold text-gray-900 border-b border-gray-300 focus:border-blue-500 focus:outline-none"
            />
          ) : (
            <h1 className="text-2xl font-bold text-gray-900">{playbook.name}</h1>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                playbook.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : playbook.status === 'draft'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {playbook.status}
            </span>
            <span className="text-sm text-gray-500">v{playbook.version}</span>
            <span className="text-sm text-gray-500">{playbook._count.campaigns} campaigns</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button
                onClick={() => setEditMode(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Edit
              </button>
              {playbook.status !== 'active' && (
                <button
                  onClick={handleActivate}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Activate
                </button>
              )}
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {(['overview', 'audiences', 'hooks', 'messages'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Positioning</label>
              {editMode ? (
                <textarea
                  value={positioning}
                  onChange={(e) => setPositioning(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Core positioning statement..."
                />
              ) : (
                <p className="text-gray-600">{playbook.positioning || 'No positioning defined'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Founder Story</label>
              {editMode ? (
                <textarea
                  value={founderStory}
                  onChange={(e) => setFounderStory(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="The story behind the business..."
                />
              ) : (
                <p className="text-gray-600">{playbook.founderStory || 'No founder story defined'}</p>
              )}
            </div>

            {playbook.campaigns.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recent Campaigns</label>
                <div className="space-y-2">
                  {playbook.campaigns.map((campaign) => (
                    <Link
                      key={campaign.id}
                      href={`/campaigns/${campaign.id}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                    >
                      <span>{campaign.name}</span>
                      <span className="text-sm text-gray-500">{campaign.status}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'audiences' && (
          <div className="space-y-6">
            {!playbook.audiences || playbook.audiences.length === 0 ? (
              <p className="text-gray-500">No audiences defined yet.</p>
            ) : (
              playbook.audiences.map((audience, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900">{audience.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{audience.description}</p>

                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Pain Points</h4>
                      <ul className="mt-2 space-y-1">
                        {audience.painPoints.map((point, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-start">
                            <span className="text-red-500 mr-2">-</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Desires</h4>
                      <ul className="mt-2 space-y-1">
                        {audience.desires.map((desire, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-start">
                            <span className="text-green-500 mr-2">+</span>
                            {desire}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {audience.objections && audience.objections.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700">Objections</h4>
                      <ul className="mt-2 space-y-1">
                        {audience.objections.map((objection, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-start">
                            <span className="text-yellow-500 mr-2">!</span>
                            {objection}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'hooks' && (
          <div className="space-y-4">
            {!playbook.hooks || playbook.hooks.length === 0 ? (
              <p className="text-gray-500">No hooks defined yet.</p>
            ) : (
              playbook.hooks.map((hook, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">&quot;{hook.text}&quot;</p>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{hook.angle}</span>
                      {hook.targetAudience && (
                        <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                          {hook.targetAudience}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">{hook.id}</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="space-y-6">
            {!playbook.keyMessages ? (
              <p className="text-gray-500">No key messages defined yet.</p>
            ) : (
              Object.entries(playbook.keyMessages).map(([segment, messages]) => (
                <div key={segment} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 capitalize">{segment}</h3>
                  <ul className="mt-2 space-y-2">
                    {messages.map((message, i) => (
                      <li key={i} className="text-sm text-gray-600 pl-4 border-l-2 border-blue-200">
                        {message}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}

            {playbook.objectionHandlers && Object.keys(playbook.objectionHandlers).length > 0 && (
              <div className="mt-8">
                <h3 className="font-semibold text-gray-900 mb-4">Objection Handlers</h3>
                <div className="space-y-3">
                  {Object.entries(playbook.objectionHandlers).map(([objection, response]) => (
                    <div key={objection} className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-700">&quot;{objection}&quot;</p>
                      <p className="text-sm text-gray-600 mt-2">{response}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
