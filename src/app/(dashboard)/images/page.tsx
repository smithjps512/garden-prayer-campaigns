import { Suspense } from 'react'
import prisma from '@/lib/prisma'
import ImageLibrary from './ImageLibrary'

async function getBusinesses() {
  return prisma.business.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  })
}

async function getImages(businessSlug?: string) {
  const where: Record<string, unknown> = {}

  if (businessSlug) {
    const business = await prisma.business.findFirst({
      where: { OR: [{ id: businessSlug }, { slug: businessSlug }] },
    })
    if (business) {
      where.businessId = business.id
    }
  }

  return prisma.image.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      business: {
        select: { id: true, name: true, slug: true },
      },
    },
  })
}

interface PageProps {
  searchParams: Promise<{ business?: string }>
}

export default async function ImagesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const [businesses, images] = await Promise.all([
    getBusinesses(),
    getImages(params.business),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Image Library</h1>
        <p className="text-gray-500 mt-1">
          Manage images for your marketing campaigns
        </p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <ImageLibrary
          initialImages={images}
          businesses={businesses}
          selectedBusiness={params.business}
        />
      </Suspense>
    </div>
  )
}
