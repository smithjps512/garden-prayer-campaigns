import Link from 'next/link'
import prisma from '@/lib/prisma'

async function getCampaigns() {
  return prisma.campaign.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      playbook: {
        include: {
          business: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
      _count: {
        select: { contents: true, tasks: true },
      },
    },
  })
}

export default async function CampaignsPage() {
  const campaigns = await getCampaigns()

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-500 mt-1">
            Manage your marketing campaigns and track performance
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
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
              d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No campaigns yet</h3>
          <p className="mt-2 text-gray-500">
            Create a campaign from a playbook to start marketing
          </p>
          <p className="text-sm text-gray-400 mt-4">Coming in Sprint 3</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/campaigns/${campaign.id}`}
              className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
            >
              <div>
                <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {campaign.playbook.business.name} •{' '}
                  {campaign._count.contents} content pieces •{' '}
                  {campaign._count.tasks} tasks
                </p>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[campaign.status]}`}
              >
                {campaign.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
