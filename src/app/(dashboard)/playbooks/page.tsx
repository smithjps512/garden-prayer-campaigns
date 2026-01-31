import Link from 'next/link'
import prisma from '@/lib/prisma'

async function getPlaybooks() {
  return prisma.playbook.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      business: {
        select: { id: true, name: true, slug: true },
      },
      _count: {
        select: { campaigns: true },
      },
    },
  })
}

export default async function PlaybooksPage() {
  const playbooks = await getPlaybooks()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Playbooks</h1>
          <p className="text-gray-500 mt-1">
            Strategic playbooks that drive your marketing campaigns
          </p>
        </div>
        <Link
          href="/playbooks/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Playbook
        </Link>
      </div>

      {playbooks.length === 0 ? (
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
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No playbooks yet</h3>
          <p className="mt-2 text-gray-500">
            Create a playbook to define your marketing strategy
          </p>
          <p className="text-sm text-gray-400 mt-4">Coming in Sprint 2</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {playbooks.map((playbook) => (
            <Link
              key={playbook.id}
              href={`/playbooks/${playbook.id}`}
              className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
            >
              <div>
                <h3 className="font-semibold text-gray-900">{playbook.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {playbook.business.name} • Version {playbook.version} •{' '}
                  {playbook._count.campaigns} campaigns
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
          ))}
        </div>
      )}
    </div>
  )
}
