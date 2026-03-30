import { prisma } from '@/lib/db'
import StorylineTabClient from './StorylineTabClient'

export default async function StorylineTab() {
  const [stories, reports] = await Promise.all([
    prisma.story.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { evidence: { orderBy: { createdAt: 'asc' } } },
    }),
    prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, area: true, createdAt: true },
    }),
  ])

  const serializedStories = stories.map(s => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    evidence: s.evidence.map(e => ({
      ...e,
      accessedAt: e.accessedAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  }))

  const serializedReports = reports.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }))

  return <StorylineTabClient stories={serializedStories} allReports={serializedReports} />
}
