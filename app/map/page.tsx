import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import MapPageClient from './MapPageClient'

export const dynamic = 'force-dynamic'

export default async function MapPage() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
  })

  return <MapPageClient projects={projects} />
}
