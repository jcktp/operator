/**
 * One-time migration: copy JournalEntry+EntryStructure data into the linked Project's
 * new story fields. Idempotent — only migrates when Project.narrative is empty.
 *
 * Run: DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/migrate-structure-to-project.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db')
const adapter = new PrismaBetterSqlite3({ url: dbPath })
const prisma = new PrismaClient({ adapter })

async function main() {
  const entries = await prisma.journalEntry.findMany({
    where: { NOT: { structure: null } },
    include: { structure: true },
  })

  let migrated = 0
  let skipped = 0

  for (const e of entries) {
    const s = e.structure!
    if (!e.projectId) { skipped++; continue }

    // Only migrate if the project hasn't been updated yet
    const project = await prisma.project.findUnique({ where: { id: e.projectId } })
    if (!project) { skipped++; continue }
    if (project.narrative !== '') { skipped++; continue }

    await prisma.project.update({
      where: { id: e.projectId },
      data: {
        narrative: e.content ?? '',
        storyStatus: (() => {
          if (s.status === 'researching') return 'draft'
          if (['draft', 'writing', 'filed'].includes(s.status)) return s.status
          return 'draft'
        })(),
        storyDescription: s.description,
        storyReportIds: s.reportIds ?? '[]',
        storyEvents: s.events ?? '[]',
        storyClaimStatuses: s.claimStatuses ?? '[]',
        storyShared: e.shared ?? false,
      },
    })
    migrated++
    console.log(`✓ Migrated: "${e.title}" (project: ${project.name})`)
  }

  console.log(`\nDone: ${migrated} migrated, ${skipped} skipped.`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
