'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Business {
  id: string
  name: string
  slug: string
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

function NewPlaybookContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessSlug = searchParams.get('business')

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [businessId, setBusinessId] = useState('')
  const [mode, setMode] = useState<'upload' | 'generate'>('upload')
  const [step, setStep] = useState<'input' | 'review'>('input')
  const [loading, setLoading] = useState(false)
  const [businessesLoading, setBusinessesLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')

  // Upload mode fields
  const [files, setFiles] = useState<Array<{ name: string; size: number; type: string; buffer: ArrayBuffer }>>([])
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

  useEffect(() => {
    fetchBusinesses()
  }, [])

  // Pre-select business once businesses are loaded
  useEffect(() => {
    if (businesses.length === 0) return
    if (businessSlug) {
      const match = businesses.find((b) => b.slug === businessSlug)
      if (match) {
        setBusinessId(match.id)
        return
      }
    }
    // Default to first business if no slug match
    if (!businessId) {
      setBusinessId(businesses[0].id)
    }
  }, [businesses, businessSlug, businessId])

  async function fetchBusinesses() {
    try {
      const res = await fetch('/api/businesses')
      const data = await res.json()
      if (data.success) {
        setBusinesses(data.data.items || data.data)
      }
    } catch (err) {
      console.error('Failed to fetch businesses:', err)
    } finally {
      setBusinessesLoading(false)
    }
  }

  function handleCancel() {
    if (businessSlug) {
      router.push(`/businesses/${businessSlug}`)
    } else {
      router.push('/playbooks')
    }
  }

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

  async function addFiles(newFiles: File[]) {
    const validExtensions = ['.pdf', '.docx', '.txt', '.md']
    const validFiles = newFiles.filter((file) => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      return validExtensions.includes(ext)
    })
    const buffered = await Promise.all(
      validFiles.map(async (file) => ({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        buffer: await file.arrayBuffer(),
      }))
    )
    setFiles((prev) => [...prev, ...buffered])
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
      files.forEach((f) => {
        const blob = new Blob([f.buffer], { type: f.type })
        const file = new File([blob], f.name, { type: f.type })
        formData.append('files', file)
      })
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
          await fetch(`/api/playbooks/${data.data.id}/activate`, {
            method: 'POST',
          })
        }
        router.push(`/playbooks/${data.data.id}`)
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
        router.push(`/playbooks/${data.data.id}`)
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

  if (businessesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Review Step
  if (step === 'review' && parsedPlaybook) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Link href="/playbooks" className="hover:text-gray-700">Playbooks</Link>
              <span>/</span>
              <span>Review Extracted Playbook</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Review Extracted Playbook</h1>
            <p className="text-gray-600 mt-1">Review and edit the extracted content before saving</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Playbook Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

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
                          <span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{pp}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {audience.desires?.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-gray-500">Desires:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {audience.desires.map((d, i) => (
                          <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{d}</span>
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
                    <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">{hook.angle}</span>
                    {hook.targetAudience && (
                      <span className="text-xs text-gray-500">Target: {hook.targetAudience}</span>
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
        </div>

        <div className="flex justify-between">
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
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
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
    )
  }

  // Input Step
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/playbooks" className="hover:text-gray-700">Playbooks</Link>
            <span>/</span>
            <span>New Playbook</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Playbook</h1>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
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

      <div className="flex justify-end gap-3">
        <button
          onClick={handleCancel}
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
  )
}

export default function NewPlaybookPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <NewPlaybookContent />
    </Suspense>
  )
}
