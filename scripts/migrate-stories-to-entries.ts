/**
 * One-time migration: convert existing Story rows into JournalEntry + EntryStructure pairs.
 *
 * Idempotent — uses Story.id as the new JournalEntry.id, so re-running is a no-op
 * (upsert by id). Repoints EvidenceItem and StorySource via their entryId column.
 *
 * Run: DATABASE_URL="file:./dev.db" npx tsx scripts/migrate-stories-to-entries.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db')
const adapter = new PrismaBetterSqlite3({ url: dbPath })
const prisma = new PrismaClient({ adapter })

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function narrativeToHtml(narrative: string | null | undefined): string {
  if (!narrative || !narrative.trim()) return ''
  return narrative
    .split(/\n\s*\n/)
    .map(p => '<p>' + escapeHtml(p).replace(/\n/g, '<br/>') + '</p>')
    .join('')
}

const STATUS_MAP: Record<string, string> = {
  researching: 'draft',
  writing: 'writing',
  filed: 'filed',
}

async function main() {
  const stories = await prisma.story.findMany({
    orderBy: { createdAt: 'asc' },
  })

  let migrated = 0
  let skipped = 0

  for (const story of stories) {
    // Use story.id as journal entry id for idempotency.
    const existing = await prisma.journalEntry.findUnique({ where: { id: story.id } })

    if (existing) {
      skipped++
      continue
    }

    const content = narrativeToHtml(story.narrative)
    const status = STATUS_MAP[story.status] ?? 'draft'

    await prisma.journalEntry.create({
      data: {
        id: story.id,
        title: story.title,
        folder: 'Stories',
        content,
        projectId: null, // Story model never had projectId; leave global.
        createdAt: story.createdAt,
        updatedAt: story.updatedAt,
      },
    })

    await prisma.entryStructure.create({
      data: {
        entryId: story.id,
        status,
        description: story.description,
        reportIds: story.reportIds ?? '[]',
        events: story.events ?? '[]',
        claimStatuses: story.claimStatuses ?? '[]',
      },
    })

    // Repoint child rows.
    await prisma.evidenceItem.updateMany({
      where: { storyId: story.id, entryId: null },
      data: { entryId: story.id },
    })
    await prisma.storySource.updateMany({
      where: { storyId: story.id, entryId: null },
      data: { entryId: story.id },
    })

    migrated++
  }

  console.log(`✓ Migration complete: ${migrated} story(ies) migrated, ${skipped} already-migrated skipped.`)
}

main()
  .catch(err => { console.error('✗ Migration failed:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
