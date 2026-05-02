import { prisma } from '@/lib/db'
import KnowledgeClient from './KnowledgeClient'

export const dynamic = 'force-dynamic'

export default async function KnowledgePage() {
  const reportAreas = await prisma.report.findMany({
    select: { area: true },
    distinct: ['area'],
    orderBy: { area: 'asc' },
  })
  const areas = reportAreas.map(r => r.area).filter((a): a is string => !!a && a.trim().length > 0)
  return <KnowledgeClient initialAreas={areas} />
}
