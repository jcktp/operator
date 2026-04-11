import { prisma } from '@/lib/db'
import StorylineTabClient from './StorylineTabClient'

export default async function StorylineTab() {
 const [stories, reports, directs] = await Promise.all([
 prisma.story.findMany({
 orderBy: { updatedAt: 'desc' },
 include: { evidence: { orderBy: { createdAt: 'asc' } } },
 }),
 prisma.report.findMany({
 orderBy: { createdAt: 'desc' },
 select: { id: true, title: true, area: true, createdAt: true },
 }),
 prisma.directReport.findMany({
 orderBy: { name: 'asc' },
 select: { id: true, name: true, title: true, area: true, updatedAt: true },
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

 const serializedDirects = directs.map(d => ({
 ...d,
 updatedAt: d.updatedAt.toISOString(),
 }))

 return <StorylineTabClient stories={serializedStories} allReports={serializedReports} allDirects={serializedDirects} />
}
