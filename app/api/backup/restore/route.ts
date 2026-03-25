import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { requireAuth } from '@/lib/api-auth'

// Restores from an uploaded .db file
// The client must reload after this completes
export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const dbUrl = process.env.DATABASE_URL ?? ''
    const dbPath = dbUrl.replace(/^file:/, '')
    const resolvedDbPath = resolve(process.cwd(), dbPath)

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'db') {
      return NextResponse.json({ error: 'Only .db files are supported for restore' }, { status: 400 })
    }

    if (!existsSync(resolvedDbPath)) {
      return NextResponse.json({ error: 'Cannot locate current database' }, { status: 500 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Verify it looks like a SQLite file (magic bytes: "SQLite format 3")
    const magic = buffer.slice(0, 16).toString('ascii')
    if (!magic.startsWith('SQLite format 3')) {
      return NextResponse.json({ error: 'File does not appear to be a valid SQLite database' }, { status: 400 })
    }

    // Disconnect Prisma before replacing the file
    await prisma.$disconnect()

    // Write the new database file
    writeFileSync(resolvedDbPath, buffer)

    // Prisma will reconnect automatically on the next query
    // Signal the client to reload the page
    return NextResponse.json({ ok: true, reload: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
