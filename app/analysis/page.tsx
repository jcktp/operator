import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import AnalysisClient from './AnalysisClient'

export const dynamic = 'force-dynamic'

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>
}) {
  const { projectId } = await searchParams

  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
    orderBy: { updatedAt: 'desc' },
  })

  return <AnalysisClient projects={projects} initialProjectId={projectId ?? ''} />
}
