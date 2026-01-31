import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true },
  })

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header user={user} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
