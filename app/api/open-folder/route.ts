import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { mkdirSync } from 'fs'
import { getReportsRoot, getAreaFolder } from '@/lib/reports-folder'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const area = body.area as string | undefined

  const folderPath = area ? getAreaFolder(area) : getReportsRoot()

  // Ensure folder exists
  mkdirSync(folderPath, { recursive: true })

  return new Promise<NextResponse>(resolve => {
    exec(`open "${folderPath}"`, err => {
      if (err) {
        resolve(NextResponse.json({ error: 'Could not open folder' }, { status: 500 }))
      } else {
        resolve(NextResponse.json({ ok: true, path: folderPath }))
      }
    })
  })
}
