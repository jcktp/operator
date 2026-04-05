import { NextResponse } from 'next/server'
import { readdirSync, statSync, existsSync } from 'fs'
import { join, extname, resolve } from 'path'
import { getReportsRoot } from '@/lib/reports-folder'
import { requireAuth } from '@/lib/api-auth'
import type { DirEntry } from '@/lib/files-types'

function isHidden(name: string) {
  return name.startsWith('.')
}

export async function GET(req: Request) {
  const authError = await requireAuth(req)
  if (authError) return authError

  const root = getReportsRoot()
  const { searchParams } = new URL(req.url)
  const rel = searchParams.get('path') ?? ''

  // Security: resolve and ensure it stays within root
  const target = resolve(join(root, rel))
  if (!target.startsWith(root)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!existsSync(target)) {
    return NextResponse.json({ entries: [] })
  }

  const entries: DirEntry[] = []
  for (const name of readdirSync(target)) {
    if (isHidden(name)) continue
    const abs = join(target, name)
    let st
    try { st = statSync(abs) } catch { continue }
    if (st.isDirectory()) {
      entries.push({ name, type: 'dir', modifiedAt: st.mtime.toISOString() })
    } else {
      entries.push({
        name,
        type: 'file',
        size: st.size,
        modifiedAt: st.mtime.toISOString(),
        ext: extname(name).replace('.', '').toLowerCase(),
      })
    }
  }

  // Dirs first, then files, each group sorted by name
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return NextResponse.json({ entries })
}
