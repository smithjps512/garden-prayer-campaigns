import { notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import DeleteBusinessButton from './DeleteBusinessButton'

interface PageProps {
  params: Promise<{ slug: string }>
}

async function getBusiness(slug: string) {
  return prisma.business.findFirst({
    where: {
      OR: [{ id: slug }, { slug }],
    },
    include: {
      playbooks: {
        orderBy: { updatedAt: 'desc' },
      },
      _count: {
        select: {
          playbooks: true,
          images: true,
          conversions: true,
        },
      },
    },
  })
}

export default async function BusinessDetailPage({ params }: PageProps) {
  const { slug } = await params
  const business = await getBusiness(slug)

  if (!business) {
    notFound()
  }

  const brandColors = (business.brandColors as Record<string, string>) || {}
  const settings = (business.settings as Record<string, unknown>) || {}

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
            <Link href="/businesses" className="hover:text-gray-700">
              Businesses
            </Link>
            <span>/</span>
            <span className="text-gray-900">{business.name}</span>
          </div>
          <div className="flex items-center space-x-3">
            {brandColors.primary && (
              <div
                className="w-6 h-6 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: brandColors.primary }}
              />
            )}
            <h1 className="text-2xl font-bold text-gray-900">{business.name}</h1>
          </div>
          {business.description && (
            <p className="text-gray-500 mt-2 max-w-2xl">{business.description}</p>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href={`/businesses/${business.slug}/edit`}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Edit
          </Link>
          <DeleteBusinessButton businessId={business.id} businessName={business.name} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Playbooks</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{business._count.playbooks}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Images</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{business._count.images}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Conversions</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{business._count.conversions}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Status</p>
          <p className="text-2xl font-bold text-green-600 mt-1">Active</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Business Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Playbooks */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Playbooks</h2>
              <Link
                href={`/playbooks/new?business=${business.slug}`}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Create Playbook
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {business.playbooks.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  <p>No playbooks yet.</p>
                  <Link
                    href={`/playbooks/new?business=${business.slug}`}
                    className="text-blue-600 hover:text-blue-700 font-medium mt-2 inline-block"
                  >
                    Create your first playbook
                  </Link>
                </div>
              ) : (
                business.playbooks.map((playbook) => (
                  <Link
                    key={playbook.id}
                    href={`/playbooks/${playbook.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{playbook.name}</p>
                      <p className="text-sm text-gray-500">
                        Version {playbook.version} • {playbook.status}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        playbook.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : playbook.status === 'draft'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {playbook.status}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link
                href={`/playbooks/new?business=${business.slug}`}
                className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700 mt-2">New Playbook</span>
              </Link>
              <Link
                href={`/campaigns/new?business=${business.slug}`}
                className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <svg
                  className="w-6 h-6 text-gray-400"
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
                <span className="text-sm font-medium text-gray-700 mt-2">New Campaign</span>
              </Link>
              <Link
                href={`/images?business=${business.slug}`}
                className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700 mt-2">View Images</span>
              </Link>
              <Link
                href={`/analytics?business=${business.slug}`}
                className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <svg
                  className="w-6 h-6 text-gray-400"
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
                <span className="text-sm font-medium text-gray-700 mt-2">Analytics</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Business Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Business Info
            </h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-500">Slug</dt>
                <dd className="text-sm font-medium text-gray-900 mt-0.5">/{business.slug}</dd>
              </div>
              {business.websiteUrl && (
                <div>
                  <dt className="text-sm text-gray-500">Website</dt>
                  <dd className="text-sm font-medium text-blue-600 mt-0.5">
                    <a
                      href={business.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {business.websiteUrl}
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-500">Created</dt>
                <dd className="text-sm font-medium text-gray-900 mt-0.5">
                  {business.createdAt.toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Last Updated</dt>
                <dd className="text-sm font-medium text-gray-900 mt-0.5">
                  {business.updatedAt.toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Brand Colors */}
          {Object.keys(brandColors).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                Brand Colors
              </h3>
              <div className="space-y-3">
                {Object.entries(brandColors).map(([name, color]) => (
                  <div key={name} className="flex items-center space-x-3">
                    <div
                      className="w-8 h-8 rounded-lg border border-gray-200"
                      style={{ backgroundColor: color }}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">{name}</p>
                      <p className="text-xs text-gray-500">{color}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings */}
          {Object.keys(settings).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                Settings
              </h3>
              <dl className="space-y-3">
                {Object.entries(settings).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-sm text-gray-500 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </dt>
                    <dd className="text-sm font-medium text-gray-900 mt-0.5">
                      {Array.isArray(value) ? value.join(', ') : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Meta Integration */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Meta Integration
            </h3>
            {business.metaPageId || business.metaIgId || business.metaAdAccount ? (
              <dl className="space-y-3">
                {business.metaPageId && (
                  <div>
                    <dt className="text-sm text-gray-500">Facebook Page ID</dt>
                    <dd className="text-sm font-medium text-gray-900 mt-0.5">
                      {business.metaPageId}
                    </dd>
                  </div>
                )}
                {business.metaIgId && (
                  <div>
                    <dt className="text-sm text-gray-500">Instagram ID</dt>
                    <dd className="text-sm font-medium text-gray-900 mt-0.5">
                      {business.metaIgId}
                    </dd>
                  </div>
                )}
                {business.metaAdAccount && (
                  <div>
                    <dt className="text-sm text-gray-500">Ad Account</dt>
                    <dd className="text-sm font-medium text-gray-900 mt-0.5">
                      {business.metaAdAccount}
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">Not connected</p>
                <button className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Connect Meta Account
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
