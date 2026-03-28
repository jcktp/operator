import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { prisma } from '@/lib/db'

// Exports the raw SQLite database file — a complete backup that can restore everything
export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL ?? ''
    const dbPath = dbUrl.replace(/^file:/, '')
    const resolvedDbPath = resolve(/*turbopackIgnore: true*/ process.cwd(), dbPath)

    if (!existsSync(resolvedDbPath)) {
      return NextResponse.json({ error: 'Database file not found' }, { status: 500 })
    }

    const dbBuffer = readFileSync(resolvedDbPath)
    const date = new Date().toISOString().slice(0, 10)

    // Update last_backup timestamp
    await prisma.setting.upsert({
      where: { key: 'last_backup' },
      update: { value: new Date().toISOString() },
      create: { id: crypto.randomUUID(), key: 'last_backup', value: new Date().toISOString() },
    })

    return new NextResponse(dbBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="operator-${date}.db"`,
        'Content-Length': dbBuffer.length.toString(),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
