import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import JournalShell from './JournalShell'

export const dynamic = 'force-dynamic'

export default async function JournalPage() {
 const [entries, projects] = await Promise.all([
 prisma.journalEntry.findMany({ orderBy: { updatedAt: 'desc' } }),
 prisma.project.findMany({
 where: { status: 'in_progress' },
 orderBy: { createdAt: 'desc' },
 select: { id: true, name: true },
 }),
 ])
 const modeConfig = getModeConfig(null)

 const serialized = entries.map(e => ({
 id: e.id,
 title: e.title,
 folder: e.folder,
 content: e.content,
 projectId: e.projectId ?? null,
 updatedAt: e.updatedAt.toISOString(),
 }))

 // Suppress: description is used inside JournalShell layout below — kept for parity with mode config.
 void modeConfig

 return <JournalShell entries={serialized} projects={projects} />
}
