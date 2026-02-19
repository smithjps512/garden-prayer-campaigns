'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

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

interface AnalyticsData {
  overview: AnalyticsOverview
  campaigns: CampaignBreakdown[]
  counts: {
    content: number
    posts: number
    performanceRecords: number
  }
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')

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

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Track performance across all your campaigns</p>
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

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Total Impressions</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {overview ? formatNumber(overview.impressions) : '--'}
          </p>
          {overview && overview.reach > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {formatNumber(overview.reach)} reach
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Total Clicks</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {overview ? formatNumber(overview.clicks) : '--'}
          </p>
          {overview && (
            <p className="text-xs text-gray-400 mt-1">{overview.ctr}% CTR</p>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Conversions</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {overview ? formatNumber(overview.conversions) : '--'}
          </p>
          {overview && parseFloat(overview.conversionValue) > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {formatCurrency(overview.conversionValue)} value
            </p>
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500">Likes</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {formatNumber(overview.likes)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500">Comments</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {formatNumber(overview.comments)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500">Shares</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {formatNumber(overview.shares)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500">Saves</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {formatNumber(overview.saves)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500">Signups</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {formatNumber(overview.signups)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500">Revenue</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {formatCurrency(overview.revenue)}
            </p>
          </div>
        </div>
      )}

      {/* No data state */}
      {!hasData && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
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
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No Performance Data Yet</h3>
          <p className="mt-2 text-gray-500">
            Performance metrics will appear here once campaigns are live and posts are published.
          </p>
          {data && (
            <p className="text-sm text-gray-400 mt-3">
              {data.counts.content} content pieces &middot; {data.counts.posts} posts tracked
            </p>
          )}
        </div>
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
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Engagement</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Spend</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {campaign.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[campaign.status] || 'bg-gray-100 text-gray-700'}`}
                      >
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {campaign.contentCount}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{campaign.postCount}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatNumber(campaign.impressions)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatNumber(campaign.clicks)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{campaign.ctr}%</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatNumber(campaign.engagement)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatCurrency(campaign.spend)}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-700">{campaign.roas}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              <p className="text-2xl font-bold text-gray-900">
                {data.counts.performanceRecords}
              </p>
              <p className="text-xs text-gray-400 mt-1">Data points collected</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
