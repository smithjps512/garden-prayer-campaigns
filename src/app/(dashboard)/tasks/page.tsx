import prisma from '@/lib/prisma'

async function getTasks() {
  return prisma.task.findMany({
    orderBy: [{ status: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
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

export default async function TasksPage() {
  const tasks = await getTasks()

  const humanTasks = tasks.filter((t) => t.assignee === 'human')
  const systemTasks = tasks.filter((t) => t.assignee === 'system')

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    blocked: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <p className="text-gray-500 mt-1">
          Track tasks assigned to you and the system
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Human Tasks */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Your Tasks</h2>
            <p className="text-sm text-gray-500">Tasks requiring human action</p>
          </div>
          {humanTasks.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p>No tasks assigned to you</p>
              <p className="text-sm text-gray-400 mt-2">Coming in Sprint 3</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {humanTasks.map((task) => (
                <div key={task.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {task.campaign.playbook.business.name} • {task.campaign.name}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[task.status]}`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Tasks */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">System Tasks</h2>
            <p className="text-sm text-gray-500">Automated tasks</p>
          </div>
          {systemTasks.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p>No automated tasks</p>
              <p className="text-sm text-gray-400 mt-2">Coming in Sprint 3</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {systemTasks.map((task) => (
                <div key={task.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {task.campaign.playbook.business.name} • {task.campaign.name}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[task.status]}`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
