import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { join, resolve } from 'path'
import { getReportsRoot } from '@/lib/reports-folder'
import { requireAuth } from '@/lib/api-auth'

export async function POST(req: Request) {
  const authError = await requireAuth(req)
  if (authError) return authError

  const root = getReportsRoot()
  const body = await req.json().catch(() => ({})) as { relativePath?: string }
  const rel = body.relativePath ?? ''

  // Security: always resolve and verify path stays within root
  const target = rel ? resolve(join(root, rel)) : root
  if (!target.startsWith(root)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const platform = process.platform
  const [bin, args]: [string, string[]] =
    platform === 'darwin' ? ['open',     [target]] :
    platform === 'win32'  ? ['explorer', [target]] :
                            ['xdg-open', [target]]

  return new Promise<NextResponse>(res => {
    execFile(bin, args, err => {
      if (err) {
        res(NextResponse.json({ error: 'Failed to open' }, { status: 500 }))
      } else {
        res(NextResponse.json({ ok: true }))
      }
    })
  })
}
