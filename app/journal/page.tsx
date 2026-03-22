import { prisma } from '@/lib/db'
import JournalShell from './JournalShell'

export const dynamic = 'force-dynamic'

export default async function JournalPage() {
  const entries = await prisma.journalEntry.findMany({
    orderBy: { updatedAt: 'desc' },
  })

  const serialized = entries.map(e => ({
    id: e.id,
    title: e.title,
    folder: e.folder,
    content: e.content,
    updatedAt: e.updatedAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Journal</h1>
        <p className="text-gray-500 text-sm mt-0.5">Notes organised by folder — auto-saved, AI-assisted</p>
      </div>
      <JournalShell entries={serialized} />
    </div>
  )
}
