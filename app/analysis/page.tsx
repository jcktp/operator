import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import AnalysisClient from './AnalysisClient'

export const dynamic = 'force-dynamic'

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>
}) {
  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  if (modeRow?.value !== 'journalism') notFound()

  const { projectId } = await searchParams

  const projects = await prisma.project.findMany({
    where: { OR: [{ mode: 'journalism' }, { mode: '' }] },
    select: { id: true, name: true },
    orderBy: { updatedAt: 'desc' },
  })

  return <AnalysisClient projects={projects} initialProjectId={projectId ?? ''} />
}
