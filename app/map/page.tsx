import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import MapPageClient from './MapPageClient'

export const dynamic = 'force-dynamic'

export default async function MapPage() {
  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  if (modeRow?.value !== 'journalism') notFound()

  const projects = await prisma.project.findMany({
    where: { OR: [{ mode: 'journalism' }, { mode: '' }] },
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
  })

  return <MapPageClient projects={projects} />
}
