import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import JournalShell from './JournalShell'

export const dynamic = 'force-dynamic'

export default async function JournalPage() {
  const [entries, modeRow, projects] = await Promise.all([
    prisma.journalEntry.findMany({ orderBy: { updatedAt: 'desc' } }),
    prisma.setting.findUnique({ where: { key: 'app_mode' } }),
    prisma.project.findMany({
      where: { status: 'in_progress' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
    }),
  ])
  const modeConfig = getModeConfig(modeRow?.value)

  const serialized = entries.map(e => ({
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
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">{modeConfig.navJournal}</h1>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5">{description}</p>
      </div>
      <JournalShell entries={serialized} projects={projects} />
    </div>
  )
}
