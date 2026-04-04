import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { mkdirSync } from 'fs'
import { getReportsRoot, getAreaFolder } from '@/lib/reports-folder'
import { requireAuth } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const body = await req.json().catch(() => ({}))
  const area = body.area as string | undefined

  const folderPath = area ? getAreaFolder(area) : getReportsRoot()

  // Ensure folder exists
  mkdirSync(folderPath, { recursive: true })

  // Use execFile to avoid shell injection — args are passed as an array, not a shell string
  return new Promise<NextResponse>(resolve => {
    execFile('open', [folderPath], err => {
      if (err) {
        resolve(NextResponse.json({ error: 'Could not open folder' }, { status: 500 }))
      } else {
        resolve(NextResponse.json({ ok: true, path: folderPath }))
      }
    })
  })
}
