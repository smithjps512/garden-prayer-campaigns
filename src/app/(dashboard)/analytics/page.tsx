'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'

// =============================================================================
// Types
// =============================================================================

interface AnalyticsOverview {
  impressions: number
  reach: number
  clicks: number
  likes: number
  comments: number
  shares: number
  saves: number
  conversions: number
  conversionValue: string
  spend: string
  revenue: string
  ctr: string
  roas: string
  signups: number
  trials: number
  purchases: number
}

interface CampaignBreakdown {
  id: string
  name: string
  status: string
  contentCount: number
  postCount: number
  conversionCount: number
  impressions: number
  clicks: number
  engagement: number
  spend: string
  revenue: string
  ctr: string
  roas: string
}

interface PostBreakdown {
  id: string
  platform: string
  platformPostId: string | null
  postedAt: string | null
  headline: string | null
  campaignName: string
  impressions: number
  reach: number
  clicks: number
  likes: number
  comments: number
  shares: number
  ctr: string
  engagementRate: string
  lastUpdated: string | null
}

interface AnalyticsData {
  overview: AnalyticsOverview
  campaigns: CampaignBreakdown[]
  posts: PostBreakdown[]
  counts: {
    content: number
    posts: number
    performanceRecords: number
  }
  lastUpdated: string | null
}

interface TimeSeriesData {
  metrics: Array<{
    date: string
    impressions: number
    clicks: number
    conversions: number
    ctr: number
    engagementRate: number
  }>
  pillarTrends: Array<Record<string, unknown>>
  audienceTrends: Array<Record<string, unknown>>
  pillars: string[]
  audiences: string[]
  funnel: {
    generated: number
    approved: number
    posted: number
    retired: number
    clicked: number
    converted: number
  }
}

interface MessageIntelligence {
  byPillar: Array<{ pillar: string; avgScore: number; contentCount: number; topPerformer: unknown }>
  byArchetype: Array<{ archetype: string; avgScore: number; contentCount: number; topPerformer: unknown }>
  byAudience: Array<{ audience: string; avgScore: number; contentCount: number; topPerformer: unknown }>
  topCombinations: Array<{ pillar: string; archetype: string; audience: string; avgScore: number }>
  bottomCombinations: Array<{ pillar: string; archetype: string; audience: string; avgScore: number }>
  untestedCombinations: Array<{ pillar: string; archetype: string; audience: string }>
}

// =============================================================================
// Component
// =============================================================================

const PILLAR_COLORS: Record<string, string> = {
  'time-back': '#3b82f6',
  'bigger-paycheck': '#10b981',
  'not-chatgpt': '#f59e0b',
}

const DATE_RANGES = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
]

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData | null>(null)
  const [intel, setIntel] = useState<MessageIntelligence | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  const [dateRange, setDateRange] = useState(30)
  const [groupBy, setGroupBy] = useState<'daily' | 'weekly'>('daily')
  const [showPostDrilldown, setShowPostDrilldown] = useState(false)
  const [activeSection, setActiveSection] = useState<'overview' | 'trends' | 'intelligence'>('overview')

  const fetchAnalytics = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedCampaign) params.set('campaignId', selectedCampaign)

      const res = await fetch(`/api/analytics?${params}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch {
      console.error('Failed to fetch analytics')
    } finally {
      setLoading(false)
    }
  }, [selectedCampaign])

  const fetchTimeSeries = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        range: dateRange.toString(),
        groupBy,
      })
      if (selectedCampaign) params.set('campaignId', selectedCampaign)

      const res = await fetch(`/api/analytics/time-series?${params}`)
      const json = await res.json()
      if (json.success) {
        setTimeSeries(json.data)
      }
    } catch {
      console.error('Failed to fetch time series')
    }
  }, [dateRange, groupBy, selectedCampaign])

  const fetchIntelligence = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedCampaign) params.set('campaignId', selectedCampaign)

      const res = await fetch(`/api/analytics/message-intelligence?${params}`)
      const json = await res.json()
      if (json.success) {
        setIntel(json.data)
      }
    } catch {
      console.error('Failed to fetch intelligence')
    }
  }, [selectedCampaign])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  useEffect(() => {
    if (activeSection === 'trends') fetchTimeSeries()
  }, [activeSection, fetchTimeSeries])

  useEffect(() => {
    if (activeSection === 'intelligence') fetchIntelligence()
  }, [activeSection, fetchIntelligence])

  function formatNumber(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toLocaleString()
  }

  function formatCurrency(v: string): string {
    const num = parseFloat(v)
    if (num === 0) return '$0.00'
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`
    return `$${num.toFixed(2)}`
  }

  const statusColors: Record<string, string> = {
    live: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
  }

  const platformColors: Record<string, string> = {
    facebook: 'bg-blue-100 text-blue-700',
    instagram: 'bg-purple-100 text-purple-700',
    twitter: 'bg-sky-100 text-sky-700',
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Track performance across all your campaigns</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="text-gray-500 mt-3">Loading analytics...</p>
        </div>
      </div>
    )
  }

  const overview = data?.overview
  const hasData =
    overview &&
    (overview.impressions > 0 ||
      overview.clicks > 0 ||
      overview.conversions > 0 ||
      parseFloat(overview.spend) > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-500">Track performance across all your campaigns</p>
            {data?.lastUpdated && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                Last updated: {new Date(data.lastUpdated).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        {data && data.campaigns.length > 0 && (
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Campaigns</option>
            {data.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Section Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {([
            { key: 'overview', label: 'Overview' },
            { key: 'trends', label: 'Trends' },
            { key: 'intelligence', label: 'Message Intelligence' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeSection === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* OVERVIEW SECTION */}
      {activeSection === 'overview' && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <p className="text-sm font-medium text-gray-500">Total Impressions</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {overview ? formatNumber(overview.impressions) : '--'}
              </p>
              {overview && overview.reach > 0 && (
                <p className="text-xs text-gray-400 mt-1">{formatNumber(overview.reach)} reach</p>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <p className="text-sm font-medium text-gray-500">Total Clicks</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {overview ? formatNumber(overview.clicks) : '--'}
              </p>
              {overview && <p className="text-xs text-gray-400 mt-1">{overview.ctr}% CTR</p>}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <p className="text-sm font-medium text-gray-500">Conversions</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {overview ? formatNumber(overview.conversions) : '--'}
              </p>
              {overview && parseFloat(overview.conversionValue) > 0 && (
                <p className="text-xs text-gray-400 mt-1">{formatCurrency(overview.conversionValue)} value</p>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <p className="text-sm font-medium text-gray-500">Total Spend</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {overview ? formatCurrency(overview.spend) : '--'}
              </p>
              {overview && parseFloat(overview.roas) > 0 && (
                <p className="text-xs text-gray-400 mt-1">{overview.roas}x ROAS</p>
              )}
            </div>
          </div>

          {/* Engagement Stats */}
          {overview && hasData && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <StatCard label="Likes" value={formatNumber(overview.likes)} />
              <StatCard label="Comments" value={formatNumber(overview.comments)} />
              <StatCard label="Shares" value={formatNumber(overview.shares)} />
              <StatCard label="Saves" value={formatNumber(overview.saves)} />
              <StatCard label="Signups" value={formatNumber(overview.signups)} />
              <StatCard label="Revenue" value={formatCurrency(overview.revenue)} />
            </div>
          )}

          {/* No data state */}
          {!hasData && (
            <EmptyChartState message="Performance metrics will appear here once campaigns are live and posts are published." />
          )}

          {/* Campaign Breakdown Table */}
          {data && data.campaigns.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Campaign Breakdown</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-6 py-3 font-medium text-gray-500">Campaign</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Content</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Posts</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Impressions</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Clicks</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">CTR</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Conversions</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Engagement</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Spend</th>
                      <th className="text-right px-6 py-3 font-medium text-gray-500">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.campaigns.map((campaign) => (
                      <tr key={campaign.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          <Link href={`/campaigns/${campaign.id}`} className="text-blue-600 hover:underline font-medium">
                            {campaign.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[campaign.status] || 'bg-gray-100 text-gray-700'}`}>
                            {campaign.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{campaign.contentCount}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{campaign.postCount}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatNumber(campaign.impressions)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatNumber(campaign.clicks)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{campaign.ctr}%</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatNumber(campaign.conversionCount)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatNumber(campaign.engagement)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(campaign.spend)}</td>
                        <td className="px-6 py-3 text-right text-gray-700">{campaign.roas}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Post Drill-Down */}
          {data && data.posts && data.posts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Post Performance</h2>
                <button
                  onClick={() => setShowPostDrilldown(!showPostDrilldown)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {showPostDrilldown ? 'Hide' : 'Show'} ({data.posts.length} posts)
                </button>
              </div>
              {showPostDrilldown && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-6 py-3 font-medium text-gray-500">Post</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Platform</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Campaign</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500">Impressions</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500">Clicks</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500">Likes</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500">Comments</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500">Shares</th>
                        <th className="text-right px-6 py-3 font-medium text-gray-500">Posted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.posts.map((post) => (
                        <tr key={post.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3">
                            <span className="text-gray-900 font-medium truncate block max-w-xs">
                              {post.headline || 'Untitled post'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${platformColors[post.platform] || 'bg-gray-100 text-gray-700'}`}>
                              {post.platform}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{post.campaignName}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatNumber(post.impressions)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatNumber(post.clicks)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatNumber(post.likes)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatNumber(post.comments)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatNumber(post.shares)}</td>
                          <td className="px-6 py-3 text-right text-gray-500 text-xs">
                            {post.postedAt ? new Date(post.postedAt).toLocaleDateString() : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Pipeline Summary */}
          {data && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Content Pieces</p>
                  <p className="text-2xl font-bold text-gray-900">{data.counts.content}</p>
                  <p className="text-xs text-gray-400 mt-1">Generated across all campaigns</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Published Posts</p>
                  <p className="text-2xl font-bold text-gray-900">{data.counts.posts}</p>
                  <p className="text-xs text-gray-400 mt-1">Distributed to platforms</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Performance Records</p>
                  <p className="text-2xl font-bold text-gray-900">{data.counts.performanceRecords}</p>
                  <p className="text-xs text-gray-400 mt-1">Data points collected</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TRENDS SECTION */}
      {activeSection === 'trends' && (
        <>
          {/* Date range and groupBy controls */}
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {DATE_RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setDateRange(r.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    dateRange === r.value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setGroupBy('daily')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  groupBy === 'daily' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setGroupBy('weekly')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  groupBy === 'weekly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Weekly
              </button>
            </div>
          </div>

          {!timeSeries || timeSeries.metrics.length === 0 ? (
            <EmptyChartState message="Not enough data yet for trend charts. Post content and wait for metrics to flow in." />
          ) : (
            <>
              {/* Impressions & Clicks */}
              <ChartCard title="Impressions & Clicks">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeries.metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip labelFormatter={(d) => new Date(d as string).toLocaleDateString()} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="impressions" stroke="#3b82f6" strokeWidth={2} dot={false} name="Impressions" />
                    <Line yAxisId="right" type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} dot={false} name="Clicks" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* CTR Over Time */}
              <ChartCard title="Click-Through Rate (%)">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={timeSeries.metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip labelFormatter={(d) => new Date(d as string).toLocaleDateString()} />
                    <Line type="monotone" dataKey="ctr" stroke="#8b5cf6" strokeWidth={2} dot={false} name="CTR %" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Conversions Over Time */}
              <ChartCard title="Conversions">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={timeSeries.metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip labelFormatter={(d) => new Date(d as string).toLocaleDateString()} />
                    <Line type="monotone" dataKey="conversions" stroke="#ef4444" strokeWidth={2} dot={false} name="Conversions" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Pillar Performance Trends */}
              {timeSeries.pillars.length > 0 && timeSeries.pillarTrends.length > 0 && (
                <ChartCard title="Performance Score by Pillar">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timeSeries.pillarTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                      <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip labelFormatter={(d) => new Date(d as string).toLocaleDateString()} />
                      <Legend />
                      {timeSeries.pillars.map((pillar) => (
                        <Line
                          key={pillar}
                          type="monotone"
                          dataKey={pillar}
                          stroke={PILLAR_COLORS[pillar] || '#6b7280'}
                          strokeWidth={2}
                          dot={false}
                          name={pillar}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Audience Performance Trends */}
              {timeSeries.audiences.length > 0 && timeSeries.audienceTrends.length > 0 && (
                <ChartCard title="Performance Score by Audience">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timeSeries.audienceTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                      <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip labelFormatter={(d) => new Date(d as string).toLocaleDateString()} />
                      <Legend />
                      {timeSeries.audiences.map((audience, i) => {
                        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                        return (
                          <Line
                            key={audience}
                            type="monotone"
                            dataKey={audience}
                            stroke={colors[i % colors.length]}
                            strokeWidth={2}
                            dot={false}
                            name={audience}
                            connectNulls
                          />
                        )
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Content Funnel */}
              {timeSeries.funnel && (
                <ChartCard title="Content Funnel">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={[
                        { stage: 'Generated', count: timeSeries.funnel.generated },
                        { stage: 'Approved', count: timeSeries.funnel.approved },
                        { stage: 'Posted', count: timeSeries.funnel.posted },
                        { stage: 'Clicked', count: timeSeries.funnel.clicked },
                        { stage: 'Converted', count: timeSeries.funnel.converted },
                      ]}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="stage" type="category" width={80} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </>
          )}
        </>
      )}

      {/* MESSAGE INTELLIGENCE SECTION */}
      {activeSection === 'intelligence' && (
        <>
          {!intel ? (
            <EmptyChartState message="Loading message intelligence data..." />
          ) : intel.byPillar.every((p) => p.contentCount === 0) ? (
            <EmptyChartState message="Not enough scored content for message intelligence. Generate and post content, then wait for performance data." />
          ) : (
            <>
              {/* Message Effectiveness Heatmap */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Message Effectiveness Matrix
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  Average performance score by audience segment and value pillar
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">Audience \ Pillar</th>
                        {intel.byPillar.map((p) => (
                          <th key={p.pillar} className="text-center px-3 py-2 font-medium text-gray-500 capitalize">
                            {p.pillar.replace(/-/g, ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {intel.byAudience.map((aud) => (
                        <tr key={aud.audience}>
                          <td className="px-3 py-2 font-medium text-gray-700">{aud.audience}</td>
                          {intel.byPillar.map((p) => {
                            const combo = [...intel.topCombinations, ...intel.bottomCombinations]
                              .find((c) => c.pillar === p.pillar && c.audience === aud.audience)
                            const isUntested = intel.untestedCombinations
                              .some((c) => c.pillar === p.pillar && c.audience === aud.audience)

                            const score = combo?.avgScore
                            const bg = isUntested
                              ? 'bg-gray-100'
                              : score === undefined
                                ? 'bg-gray-50'
                                : score >= 70
                                  ? 'bg-green-100'
                                  : score >= 40
                                    ? 'bg-yellow-100'
                                    : 'bg-red-100'
                            const text = isUntested
                              ? 'text-gray-400'
                              : score === undefined
                                ? 'text-gray-400'
                                : score >= 70
                                  ? 'text-green-700'
                                  : score >= 40
                                    ? 'text-yellow-700'
                                    : 'text-red-700'

                            return (
                              <td key={`${aud.audience}-${p.pillar}`} className={`text-center px-3 py-2 ${bg}`}>
                                <span className={`font-semibold ${text}`}>
                                  {isUntested ? '\u2014' : score !== undefined ? score : '\u2014'}
                                </span>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-200"></span> High (70+)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200"></span> Medium (40-69)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200"></span> Low (&lt;40)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-200"></span> Untested</span>
                </div>
              </div>

              {/* Archetype Performance */}
              <ChartCard title="Performance by Content Archetype">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={intel.byArchetype.filter((a) => a.contentCount > 0).sort((a, b) => b.avgScore - a.avgScore)}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <YAxis
                      dataKey="archetype"
                      type="category"
                      width={120}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => v.replace(/-/g, ' ')}
                    />
                    <Tooltip formatter={(v: number | string | undefined) => [`${v ?? 0} score`, 'Avg Score']} />
                    <Bar dataKey="avgScore" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Avg Score" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Top and Bottom Combinations */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {intel.topCombinations.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Top Performing Combinations</h3>
                    <div className="space-y-3">
                      {intel.topCombinations.map((combo, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{combo.pillar}</span>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{combo.archetype}</span>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{combo.audience}</span>
                          </div>
                          <span className="font-bold text-green-700 text-lg">{combo.avgScore}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {intel.bottomCombinations.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Lowest Performing Combinations</h3>
                    <div className="space-y-3">
                      {intel.bottomCombinations.map((combo, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{combo.pillar}</span>
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{combo.archetype}</span>
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{combo.audience}</span>
                          </div>
                          <span className="font-bold text-red-700 text-lg">{combo.avgScore}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Untested Combinations */}
              {intel.untestedCombinations.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Untested Combinations</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    These pillar/archetype/audience combinations haven&apos;t been tried yet.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {intel.untestedCombinations.slice(0, 12).map((combo, i) => (
                      <span
                        key={i}
                        className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg"
                      >
                        {combo.pillar} / {combo.archetype} / {combo.audience}
                      </span>
                    ))}
                    {intel.untestedCombinations.length > 12 && (
                      <span className="text-xs text-gray-400 px-2 py-1">
                        +{intel.untestedCombinations.length - 12} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  )
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="mt-4 text-gray-500">{message}</p>
    </div>
  )
}
