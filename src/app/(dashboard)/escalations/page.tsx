import prisma from '@/lib/prisma'

async function getEscalations() {
  return prisma.escalation.findMany({
    where: { status: { in: ['open', 'acknowledged'] } },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
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
    },
  })
}

export default async function EscalationsPage() {
  const escalations = await getEscalations()

  const severityColors: Record<string, string> = {
    info: 'bg-blue-100 text-blue-800',
    warning: 'bg-yellow-100 text-yellow-800',
    critical: 'bg-red-100 text-red-800',
  }

  const typeIcons: Record<string, string> = {
    below_threshold: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6',
    persistent_failure: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    budget_depleted: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    anomaly_detected: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    strategic_question: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Escalations</h1>
        <p className="text-gray-500 mt-1">
          Issues requiring your attention
        </p>
      </div>

      {escalations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">All Clear</h3>
          <p className="mt-2 text-gray-500">
            No escalations requiring attention
          </p>
          <p className="text-sm text-gray-400 mt-4">
            Escalations will appear here when campaigns need intervention (Coming in Sprint 5)
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {escalations.map((escalation) => (
            <div
              key={escalation.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start space-x-4">
                <div
                  className={`p-2 rounded-lg ${
                    escalation.severity === 'critical'
                      ? 'bg-red-100'
                      : escalation.severity === 'warning'
                        ? 'bg-yellow-100'
                        : 'bg-blue-100'
                  }`}
                >
                  <svg
                    className={`w-6 h-6 ${
                      escalation.severity === 'critical'
                        ? 'text-red-600'
                        : escalation.severity === 'warning'
                          ? 'text-yellow-600'
                          : 'text-blue-600'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={typeIcons[escalation.type] || typeIcons.anomaly_detected}
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{escalation.title}</h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${severityColors[escalation.severity]}`}
                    >
                      {escalation.severity}
                    </span>
                  </div>
                  {escalation.description && (
                    <p className="text-sm text-gray-600 mt-1">{escalation.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {escalation.campaign.playbook.business.name} • {escalation.campaign.name}
                  </p>
                  {escalation.aiAnalysis && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700">AI Analysis</p>
                      <p className="text-sm text-gray-600 mt-1">{escalation.aiAnalysis}</p>
                    </div>
                  )}
                  {escalation.aiRecommendation && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-700">Recommendation</p>
                      <p className="text-sm text-blue-600 mt-1">{escalation.aiRecommendation}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
