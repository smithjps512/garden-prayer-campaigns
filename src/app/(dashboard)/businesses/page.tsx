import Link from 'next/link'
import prisma from '@/lib/prisma'

async function getBusinesses() {
  return prisma.business.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          playbooks: true,
          images: true,
        },
      },
    },
  })
}

export default async function BusinessesPage() {
  const businesses = await getBusinesses()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Businesses</h1>
          <p className="text-gray-500 mt-1">
            Manage your businesses and their marketing campaigns
          </p>
        </div>
        <Link
          href="/businesses/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Business
        </Link>
      </div>

      {businesses.length === 0 ? (
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
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No businesses yet</h3>
          <p className="mt-2 text-gray-500">
            Get started by creating your first business.
          </p>
          <Link
            href="/businesses/new"
            className="mt-6 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            Create Business
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {businesses.map((business) => (
            <Link
              key={business.id}
              href={`/businesses/${business.slug}`}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    {business.brandColors &&
                    typeof business.brandColors === 'object' &&
                    'primary' in business.brandColors ? (
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{
                          backgroundColor:
                            (business.brandColors as Record<string, string>).primary || '#6B7280',
                        }}
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-gray-400" />
                    )}
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {business.name}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">/{business.slug}</p>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors"
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
              </div>

              {business.description && (
                <p className="text-sm text-gray-600 mt-3 line-clamp-2">
                  {business.description}
                </p>
              )}

              <div className="flex items-center space-x-4 mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center text-sm text-gray-500">
                  <svg
                    className="w-4 h-4 mr-1.5 text-gray-400"
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
                  {business._count.playbooks} playbooks
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <svg
                    className="w-4 h-4 mr-1.5 text-gray-400"
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
                  {business._count.images} images
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
