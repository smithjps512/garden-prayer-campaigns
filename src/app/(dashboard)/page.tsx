import Link from 'next/link'
import prisma from '@/lib/prisma'

async function getStats() {
  const [businessCount, playbookCount, campaignCount, imageCount, escalationCount] =
    await Promise.all([
      prisma.business.count(),
      prisma.playbook.count(),
      prisma.campaign.count(),
      prisma.image.count(),
      prisma.escalation.count({ where: { status: 'open' } }),
    ])

  return { businessCount, playbookCount, campaignCount, imageCount, escalationCount }
}

async function getRecentActivity() {
  return prisma.activityLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      business: { select: { name: true } },
      campaign: { select: { name: true } },
    },
  })
}

async function getBusinesses() {
  return prisma.business.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          playbooks: true,
          images: true,
        },
      },
    },
  })
}

export default async function DashboardPage() {
  const [stats, activity, businesses] = await Promise.all([
    getStats(),
    getRecentActivity(),
    getBusinesses(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Overview of your marketing automation system
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Businesses"
          value={stats.businessCount}
          href="/businesses"
          color="blue"
        />
        <StatCard
          title="Playbooks"
          value={stats.playbookCount}
          href="/playbooks"
          color="purple"
        />
        <StatCard
          title="Campaigns"
          value={stats.campaignCount}
          href="/campaigns"
          color="green"
        />
        <StatCard
          title="Images"
          value={stats.imageCount}
          href="/images"
          color="orange"
        />
        <StatCard
          title="Open Escalations"
          value={stats.escalationCount}
          href="/escalations"
          color={stats.escalationCount > 0 ? 'red' : 'gray'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Businesses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Businesses</h2>
            <Link
              href="/businesses/new"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add New
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {businesses.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                <p>No businesses yet.</p>
                <Link
                  href="/businesses/new"
                  className="text-blue-600 hover:text-blue-700 font-medium mt-2 inline-block"
                >
                  Create your first business
                </Link>
              </div>
            ) : (
              businesses.map((business) => (
                <Link
                  key={business.id}
                  href={`/businesses/${business.slug}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{business.name}</p>
                    <p className="text-sm text-gray-500">
                      {business._count.playbooks} playbooks, {business._count.images} images
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400"
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
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {activity.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                <p>No activity yet.</p>
                <p className="text-sm mt-1">
                  Activity will appear here as you use the system.
                </p>
              </div>
            ) : (
              activity.map((log) => (
                <div key={log.id} className="px-6 py-3">
                  <div className="flex items-start space-x-3">
                    <div
                      className={`w-2 h-2 rounded-full mt-2 ${
                        log.actor === 'system' ? 'bg-blue-500' : 'bg-green-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium capitalize">{log.actor}</span>{' '}
                        {formatAction(log.action)}
                        {log.campaign && (
                          <span className="text-gray-500">
                            {' '}
                            in {log.campaign.name}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(log.createdAt)}
                        {log.business && ` • ${log.business.name}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickAction
            href="/businesses/new"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            }
            label="Add Business"
          />
          <QuickAction
            href="/playbooks/new"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            label="New Playbook"
          />
          <QuickAction
            href="/campaigns/new"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              </svg>
            }
            label="New Campaign"
          />
          <QuickAction
            href="/images"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            label="Upload Images"
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  href,
  color,
}: {
  title: string
  value: number
  href: string
  color: 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'gray'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-600',
  }

  return (
    <Link
      href={href}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
    >
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${colorClasses[color]}`}>{value}</p>
    </Link>
  )
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
    >
      <span className="text-gray-400 group-hover:text-blue-600 transition-colors">
        {icon}
      </span>
      <span className="text-sm font-medium text-gray-700 mt-2 group-hover:text-blue-600">
        {label}
      </span>
    </Link>
  )
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ')
}

function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString()
}
