import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import ResearchClient from './ResearchClient'

export const dynamic = 'force-dynamic'

export default async function ResearchPage() {
  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  if (modeRow?.value !== 'journalism') notFound()

  const projects = await prisma.project.findMany({
    where: { OR: [{ mode: 'journalism' }, { mode: '' }] },
    select: {
      id: true,
      name: true,
      reports: {
        select: { id: true, title: true, rawContent: true },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return <ResearchClient projects={projects} />
}
