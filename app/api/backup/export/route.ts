import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

export async function GET() {
  try {
    // Determine DB path from DATABASE_URL
    const dbUrl = process.env.DATABASE_URL ?? ''
    const dbPath = dbUrl.replace(/^file:/, '')
    const resolvedDbPath = resolve(process.cwd(), dbPath)

    if (!existsSync(resolvedDbPath)) {
      return NextResponse.json({ error: 'Database file not found' }, { status: 500 })
    }

    // Build JSON export of all records (redact sensitive keys)
    const REDACTED = new Set(['auth_password_hash', 'auth_session_token', 'anthropic_key', 'openai_key', 'google_key', 'groq_key', 'xai_key', 'perplexity_key'])
    const [reports, directs, journal, chats, settings] = await Promise.all([
      prisma.report.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.directReport.findMany({ orderBy: { name: 'asc' } }),
      prisma.journalEntry.findMany({ orderBy: { updatedAt: 'desc' } }),
      prisma.dispatchChat.findMany({ orderBy: { updatedAt: 'desc' } }),
      prisma.setting.findMany(),
    ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: 1,
      reports,
      directReports: directs,
      journalEntries: journal,
      dispatchChats: chats,
      settings: settings
        .filter(s => !REDACTED.has(s.key))
        .map(s => ({ key: s.key, value: s.value })),
    }

    const jsonBuffer = Buffer.from(JSON.stringify(exportData, null, 2), 'utf-8')
    const dbBuffer = readFileSync(resolvedDbPath)

    // Update last_backup timestamp
    await prisma.setting.upsert({
      where: { key: 'last_backup' },
      update: { value: new Date().toISOString() },
      create: { id: crypto.randomUUID(), key: 'last_backup', value: new Date().toISOString() },
    })

    // Build a simple concatenated response — we'll send DB file for now
    // Package both files as a multipart-like bundle by returning JSON export
    // For simplicity and no-dependency approach: return JSON export only
    // Users can also grab dev.db directly from the filesystem
    const date = new Date().toISOString().slice(0, 10)
    const filename = `operator-backup-${date}.json`

    // Return JSON export as download
    return new NextResponse(jsonBuffer, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': jsonBuffer.length.toString(),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
