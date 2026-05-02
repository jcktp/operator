import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import SpeakersClient from './SpeakersClient'

export const dynamic = 'force-dynamic'

export default async function SpeakersPage() {
  const rawProjects = await prisma.project.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const areaRows = await prisma.report.findMany({
    where: { projectId: { in: rawProjects.map(p => p.id) }, area: { not: '' } },
    select: { projectId: true, area: true },
    distinct: ['projectId', 'area'],
    orderBy: { area: 'asc' },
  })

  const areasByProject: Record<string, string[]> = {}
  for (const row of areaRows) {
    if (!row.projectId) continue
    if (!areasByProject[row.projectId]) areasByProject[row.projectId] = []
    areasByProject[row.projectId].push(row.area)
  }

  const projects = rawProjects.map(p => ({
    id: p.id,
    name: p.name,
    areas: areasByProject[p.id] ?? [],
  }))

  return <SpeakersClient projects={projects} />
}
