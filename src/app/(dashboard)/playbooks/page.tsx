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
  status: 'draft' | 'active' | 'archived'
  version: number
  positioning: string | null
  createdAt: string
  updatedAt: string
  business: Business
  _count: {
    campaigns: number
  }
}

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [filterBusiness, setFilterBusiness] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    fetchPlaybooks()
    fetchBusinesses()
  }, [filterBusiness, filterStatus])

  async function fetchPlaybooks() {
    try {
      const params = new URLSearchParams()
      if (filterBusiness) params.append('businessId', filterBusiness)
      if (filterStatus) params.append('status', filterStatus)

      const res = await fetch(`/api/playbooks?${params}`)
      const data = await res.json()
      if (data.success) {
        setPlaybooks(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch playbooks:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchBusinesses() {
    try {
      const res = await fetch('/api/businesses')
      const data = await res.json()
      if (data.success) {
        // Handle paginated response
        setBusinesses(data.data.items || data.data)
      }
    } catch (error) {
      console.error('Failed to fetch businesses:', error)
    }
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      archived: 'bg-yellow-100 text-yellow-800',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {status}
      </span>
    )
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
          <h1 className="text-2xl font-bold text-gray-900">Playbooks</h1>
          <p className="text-gray-600">Strategic marketing playbooks for your campaigns</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Playbook
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filterBusiness}
          onChange={(e) => setFilterBusiness(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Businesses</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Playbooks Grid */}
      {playbooks.length === 0 ? (
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
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No playbooks</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new playbook.</p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + New Playbook
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {playbooks.map((playbook) => (
            <Link
              key={playbook.id}
              href={`/playbooks/${playbook.id}`}
              className="block bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{playbook.name}</h3>
                  <p className="text-sm text-gray-500">{playbook.business.name}</p>
                </div>
                {getStatusBadge(playbook.status)}
              </div>

              {playbook.positioning && (
                <p className="mt-3 text-sm text-gray-600 line-clamp-2">{playbook.positioning}</p>
              )}

              <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                <span>v{playbook.version}</span>
                <span>{playbook._count.campaigns} campaigns</span>
              </div>

              <div className="mt-2 text-xs text-gray-400">
                Updated {new Date(playbook.updatedAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreatePlaybookModal
          businesses={businesses}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            fetchPlaybooks()
          }}
        />
      )}
    </div>
  )
}

interface ParsedPlaybook {
  name: string
  positioning: string | null
  founderStory: string | null
  audiences: Array<{
    name: string
    description: string
    painPoints: string[]
    desires: string[]
    objections?: string[]
    demographics?: string
    psychographics?: string
  }>
  keyMessages: Record<string, string[]>
  objectionHandlers: Record<string, string>
  hooks: Array<{
    id: string
    text: string
    angle: string
    targetAudience?: string
    emotion?: string
  }>
  visualDirection: {
    brandColors?: Record<string, string>
    imageStyle?: string
    tone?: string
    doNots?: string[]
    guidelines?: string[]
  } | null
  content: {
    campaignStructure?: Array<{
      name: string
      type: string
      audience: string
      duration?: string
      budget?: string
      channels?: string[]
    }>
    taskAssignments?: Array<{
      task: string
      assignee: 'human' | 'system'
      priority?: number
      description?: string
    }>
    targetMarkets?: string[]
    successMetrics?: Record<string, number | string>
    imageRequirements?: string[]
  } | null
}

function CreatePlaybookModal({
  businesses,
  onClose,
  onCreated,
}: {
  businesses: Business[]
  onClose: () => void
  onCreated: () => void
}) {
  const [mode, setMode] = useState<'upload' | 'generate'>('upload')
  const [step, setStep] = useState<'input' | 'review'>('input')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Common fields
  const [businessId, setBusinessId] = useState(businesses[0]?.id || '')
  const [name, setName] = useState('')

  // Upload mode fields
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [parsedPlaybook, setParsedPlaybook] = useState<ParsedPlaybook | null>(null)

  // Generate mode fields
  const [brief, setBrief] = useState({
    businessName: '',
    industry: '',
    product: '',
    pricePoint: '',
    targetMarket: '',
    competitors: '',
    uniqueValue: '',
    founderStory: '',
  })

  const selectedBusiness = businesses.find((b) => b.id === businessId)

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
  }

  function addFiles(newFiles: File[]) {
    const validExtensions = ['.pdf', '.docx', '.txt', '.md']
    const validFiles = newFiles.filter((file) => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      return validExtensions.includes(ext)
    })
    setFiles((prev) => [...prev, ...validFiles])
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function getFileIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'pdf':
        return (
          <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
            <path d="M8 12h8v2H8zm0 4h5v2H8z" />
          </svg>
        )
      case 'docx':
        return (
          <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
            <path d="M8 12h8v2H8zm0 4h8v2H8z" />
          </svg>
        )
      default:
        return (
          <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
          </svg>
        )
    }
  }

  async function handleParseDocuments() {
    if (files.length === 0) {
      setError('Please upload at least one document')
      return
    }

    if (!businessId) {
      setError('Please select a business')
      return
    }

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      formData.append('businessName', selectedBusiness?.name || '')

      const res = await fetch('/api/playbooks/parse', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (data.success) {
        setParsedPlaybook(data.data.playbook)
        setName(data.data.playbook.name || `${selectedBusiness?.name} Playbook`)
        setStep('review')
      } else {
        setError(data.error || 'Failed to parse documents')
      }
    } catch {
      setError('Failed to parse documents')
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePlaybook(activate: boolean = false) {
    if (!businessId || !name) {
      setError('Business and name are required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const body = {
        businessId,
        name,
        positioning: parsedPlaybook?.positioning,
        founderStory: parsedPlaybook?.founderStory,
        audiences: parsedPlaybook?.audiences,
        keyMessages: parsedPlaybook?.keyMessages,
        objectionHandlers: parsedPlaybook?.objectionHandlers,
        hooks: parsedPlaybook?.hooks,
        visualDirection: parsedPlaybook?.visualDirection,
        content: parsedPlaybook?.content,
      }

      const res = await fetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (data.success) {
        if (activate) {
          // Activate the playbook
          await fetch(`/api/playbooks/${data.data.id}/activate`, {
            method: 'POST',
          })
        }
        onCreated()
      } else {
        setError(data.error || 'Failed to create playbook')
      }
    } catch {
      setError('Failed to create playbook')
    } finally {
      setLoading(false)
    }
  }

  async function handleGeneratePlaybook() {
    if (!businessId || !name) {
      setError('Business and name are required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/playbooks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, name, brief }),
      })

      const data = await res.json()
      if (data.success) {
        onCreated()
      } else {
        setError(data.error || 'Failed to generate playbook')
      }
    } catch {
      setError('Failed to generate playbook')
    } finally {
      setLoading(false)
    }
  }

  function updateParsedPlaybook(field: keyof ParsedPlaybook, value: unknown) {
    if (parsedPlaybook) {
      setParsedPlaybook({ ...parsedPlaybook, [field]: value })
    }
  }

  // Review Step UI
  if (step === 'review' && parsedPlaybook) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden m-4 flex flex-col">
          <div className="p-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Review Extracted Playbook</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Review and edit the extracted content before saving
                </p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto flex-grow space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error}</div>
            )}

            {/* Playbook Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Playbook Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Positioning */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Positioning</label>
              <textarea
                value={parsedPlaybook.positioning || ''}
                onChange={(e) => updateParsedPlaybook('positioning', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Core positioning statement..."
              />
            </div>

            {/* Founder Story */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Founder Story</label>
              <textarea
                value={parsedPlaybook.founderStory || ''}
                onChange={(e) => updateParsedPlaybook('founderStory', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="The story behind the business..."
              />
            </div>

            {/* Audiences */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Audience Segments ({parsedPlaybook.audiences?.length || 0})
              </label>
              <div className="space-y-3">
                {parsedPlaybook.audiences?.map((audience, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="font-medium text-gray-900">{audience.name}</div>
                    <p className="text-sm text-gray-600 mt-1">{audience.description}</p>
                    {audience.painPoints?.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-gray-500">Pain Points:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {audience.painPoints.map((pp, i) => (
                            <span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                              {pp}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {audience.desires?.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-gray-500">Desires:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {audience.desires.map((d, i) => (
                            <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {(!parsedPlaybook.audiences || parsedPlaybook.audiences.length === 0) && (
                  <p className="text-sm text-gray-500 italic">No audience segments extracted</p>
                )}
              </div>
            </div>

            {/* Hooks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hooks ({parsedPlaybook.hooks?.length || 0})
              </label>
              <div className="space-y-2">
                {parsedPlaybook.hooks?.map((hook, index) => (
                  <div key={index} className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-gray-900">&ldquo;{hook.text}&rdquo;</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">
                        {hook.angle}
                      </span>
                      {hook.targetAudience && (
                        <span className="text-xs text-gray-500">
                          Target: {hook.targetAudience}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {(!parsedPlaybook.hooks || parsedPlaybook.hooks.length === 0) && (
                  <p className="text-sm text-gray-500 italic">No hooks extracted</p>
                )}
              </div>
            </div>

            {/* Objection Handlers */}
            {parsedPlaybook.objectionHandlers && Object.keys(parsedPlaybook.objectionHandlers).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Objection Handlers ({Object.keys(parsedPlaybook.objectionHandlers).length})
                </label>
                <div className="space-y-2">
                  {Object.entries(parsedPlaybook.objectionHandlers).map(([objection, response], index) => (
                    <div key={index} className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      <p className="text-sm font-medium text-gray-900">Q: {objection}</p>
                      <p className="text-sm text-gray-600 mt-1">A: {response}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visual Direction */}
            {parsedPlaybook.visualDirection && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Visual Direction</label>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  {parsedPlaybook.visualDirection.tone && (
                    <p className="text-sm"><strong>Tone:</strong> {parsedPlaybook.visualDirection.tone}</p>
                  )}
                  {parsedPlaybook.visualDirection.imageStyle && (
                    <p className="text-sm mt-1"><strong>Image Style:</strong> {parsedPlaybook.visualDirection.imageStyle}</p>
                  )}
                  {parsedPlaybook.visualDirection.guidelines && parsedPlaybook.visualDirection.guidelines.length > 0 && (
                    <div className="mt-2">
                      <strong className="text-sm">Guidelines:</strong>
                      <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                        {parsedPlaybook.visualDirection.guidelines.map((g, i) => (
                          <li key={i}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional Content */}
            {parsedPlaybook.content && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Content</label>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                  {parsedPlaybook.content.targetMarkets && parsedPlaybook.content.targetMarkets.length > 0 && (
                    <div>
                      <strong className="text-sm">Target Markets:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parsedPlaybook.content.targetMarkets.map((m, i) => (
                          <span key={i} className="text-xs bg-gray-200 px-2 py-0.5 rounded">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {parsedPlaybook.content.successMetrics && Object.keys(parsedPlaybook.content.successMetrics).length > 0 && (
                    <div>
                      <strong className="text-sm">Success Metrics:</strong>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {Object.entries(parsedPlaybook.content.successMetrics).map(([key, value], i) => (
                          <span key={i} className="text-xs bg-green-200 px-2 py-0.5 rounded">
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {parsedPlaybook.content.imageRequirements && parsedPlaybook.content.imageRequirements.length > 0 && (
                    <div>
                      <strong className="text-sm">Image Requirements:</strong>
                      <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                        {parsedPlaybook.content.imageRequirements.map((req, i) => (
                          <li key={i}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200 flex-shrink-0 flex justify-between">
            <button
              onClick={() => {
                setStep('input')
                setParsedPlaybook(null)
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => handleSavePlaybook(false)}
                disabled={loading}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                onClick={() => handleSavePlaybook(true)}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save & Activate'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Input Step UI
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Create New Playbook</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setMode('upload')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'upload'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Upload Materials
            </button>
            <button
              onClick={() => setMode('generate')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'generate'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              AI Generate
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error}</div>
          )}

          {/* Business Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business</label>
            <select
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {mode === 'upload' ? (
            <>
              {/* File Upload Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
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
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="mt-2 text-sm text-gray-600">
                  <label className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium">
                    Upload files
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.txt,.md"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                  {' '}or drag and drop
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  PDF, DOCX, TXT, MD files (brand briefs, playbooks, comparison charts)
                </p>
              </div>

              {/* Uploaded Files List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Uploaded Files ({files.length})
                  </label>
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.name)}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-600">Analyzing your documents...</p>
                    <p className="text-xs text-gray-500 mt-1">
                      This may take a moment depending on document size
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* AI Generate Mode */
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Playbook Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Q1 2026 Launch Playbook"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="space-y-4 border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-600">
                  Provide details about your business and AI will generate a complete playbook.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                    <input
                      type="text"
                      value={brief.businessName}
                      onChange={(e) => setBrief({ ...brief, businessName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                    <input
                      type="text"
                      value={brief.industry}
                      onChange={(e) => setBrief({ ...brief, industry: e.target.value })}
                      placeholder="e.g., Education, Real Estate"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product/Service</label>
                  <input
                    type="text"
                    value={brief.product}
                    onChange={(e) => setBrief({ ...brief, product: e.target.value })}
                    placeholder="What do you sell?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price Point</label>
                    <input
                      type="text"
                      value={brief.pricePoint}
                      onChange={(e) => setBrief({ ...brief, pricePoint: e.target.value })}
                      placeholder="e.g., $99/year"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Market</label>
                    <input
                      type="text"
                      value={brief.targetMarket}
                      onChange={(e) => setBrief({ ...brief, targetMarket: e.target.value })}
                      placeholder="e.g., US Teachers"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unique Value Proposition</label>
                  <textarea
                    value={brief.uniqueValue}
                    onChange={(e) => setBrief({ ...brief, uniqueValue: e.target.value })}
                    placeholder="What makes you different?"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Competitors (optional)
                  </label>
                  <input
                    type="text"
                    value={brief.competitors}
                    onChange={(e) => setBrief({ ...brief, competitors: e.target.value })}
                    placeholder="e.g., Competitor A, Competitor B"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Founder Story (optional)
                  </label>
                  <textarea
                    value={brief.founderStory}
                    onChange={(e) => setBrief({ ...brief, founderStory: e.target.value })}
                    placeholder="The story behind the business..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
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
          {mode === 'upload' ? (
            <button
              onClick={handleParseDocuments}
              disabled={loading || files.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Analyze Documents'}
            </button>
          ) : (
            <button
              onClick={handleGeneratePlaybook}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Playbook'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
