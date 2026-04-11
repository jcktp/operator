import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import JournalShell from './JournalShell'

export const dynamic = 'force-dynamic'

export default async function JournalPage() {
 const [modeRow, entries, projects] = await Promise.all([
 prisma.setting.findUnique({ where: { key: 'app_mode' } }),
 prisma.journalEntry.findMany({ orderBy: { updatedAt: 'desc' } }),
 prisma.project.findMany({
 where: { status: 'in_progress' },
 orderBy: { createdAt: 'desc' },
 select: { id: true, name: true, mode: true },
 }),
 ])
 const currentMode = modeRow?.value ?? ''
 const modeConfig = getModeConfig(currentMode)
 const filteredEntries = entries.filter(e => e.mode === '' || e.mode === currentMode)
 const filteredProjects = projects.filter(p => p.mode === '' || p.mode === currentMode)

 const serialized = filteredEntries.map(e => ({
 id: e.id,
 title: e.title,
 folder: e.folder,
 content: e.content,
 projectId: e.projectId ?? null,
 updatedAt: e.updatedAt.toISOString(),
 }))

 const description = modeConfig.features.journalDescription ?? 'Notes organised by folder — auto-saved, AI-assisted'

 return (
 <div className="space-y-6">
 <div className="sticky top-14 z-20 bg-[var(--background)] border-b border-[var(--border)] py-5 -mx-6 px-6 sm:-mx-8 sm:px-8">
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">{modeConfig.navJournal}</h1>
 <p className="text-[var(--text-muted)] text-sm mt-0.5">{description}</p>
 </div>
 <JournalShell entries={serialized} projects={filteredProjects.map(p => ({ id: p.id, name: p.name }))} />
 </div>
 )
}
