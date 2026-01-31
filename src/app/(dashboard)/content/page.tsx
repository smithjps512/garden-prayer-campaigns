import prisma from '@/lib/prisma'

async function getContent() {
  return prisma.content.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      campaign: {
        include: {
          playbook: {
            include: {
              business: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
      },
      image: {
        select: { id: true, storageUrl: true, filename: true },
      },
    },
  })
}

export default async function ContentPage() {
  const content = await getContent()

  const statusColors: Record<string, string> = {
    generated: 'bg-gray-100 text-gray-800',
    approved: 'bg-blue-100 text-blue-800',
    scheduled: 'bg-purple-100 text-purple-800',
    posted: 'bg-green-100 text-green-800',
    paused: 'bg-orange-100 text-orange-800',
    retired: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Library</h1>
          <p className="text-gray-500 mt-1">
            All generated content for your campaigns
          </p>
        </div>
      </div>

      {content.length === 0 ? (
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No content yet</h3>
          <p className="mt-2 text-gray-500">
            Content will be generated when you create campaigns
          </p>
          <p className="text-sm text-gray-400 mt-4">Coming in Sprint 2</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {content.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              {item.image && (
                <div className="aspect-video bg-gray-100">
                  <img
                    src={item.image.storageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 capitalize">
                    {item.type.replace('_', ' ')}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[item.status]}`}
                  >
                    {item.status}
                  </span>
                </div>
                {item.headline && (
                  <h3 className="font-semibold text-gray-900 mb-1">{item.headline}</h3>
                )}
                {item.body && (
                  <p className="text-sm text-gray-600 line-clamp-3">{item.body}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {item.campaign.playbook.business.name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
