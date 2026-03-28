import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readFileSync, existsSync, mkdirSync, copyFileSync, cpSync } from 'fs'
import { resolve, join } from 'path'
import { getReportsRoot } from '@/lib/reports-folder'

// POST: copy DB + reports folder to the configured backup path
export async function POST(req: NextRequest) {
  try {
    const { path: backupPath } = await req.json() as { path?: string }
    if (!backupPath?.trim()) {
      return NextResponse.json({ error: 'No backup path provided' }, { status: 400 })
    }

    const dbUrl = process.env.DATABASE_URL ?? ''
    const dbPath = dbUrl.replace(/^file:/, '')
    const resolvedDbPath = resolve(/*turbopackIgnore: true*/ process.cwd(), dbPath)

    if (!existsSync(resolvedDbPath)) {
      return NextResponse.json({ error: 'Database file not found' }, { status: 500 })
    }

    const dest = resolve(backupPath.trim())
    mkdirSync(dest, { recursive: true })

    // Copy DB file
    const date = new Date().toISOString().slice(0, 10)
    copyFileSync(resolvedDbPath, join(dest, `operator-${date}.db`))

    // Copy Operator Reports folder if it exists
    const reportsRoot = getReportsRoot()
    if (existsSync(reportsRoot)) {
      cpSync(reportsRoot, join(dest, 'Operator Reports'), { recursive: true })
    }

    // Update last_backup setting
    await prisma.setting.upsert({
      where: { key: 'last_backup' },
      update: { value: new Date().toISOString() },
      create: { id: crypto.randomUUID(), key: 'last_backup', value: new Date().toISOString() },
    })

    // Save the backup path
    await prisma.setting.upsert({
      where: { key: 'backup_path' },
      update: { value: backupPath.trim() },
      create: { id: crypto.randomUUID(), key: 'backup_path', value: backupPath.trim() },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
