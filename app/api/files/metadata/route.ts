import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { resolveWithinRoot, readMetadata } from '@/lib/file-cleaner'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const body = await req.json() as { relativePath?: string }
  const { relativePath } = body

  if (!relativePath) {
    return NextResponse.json({ error: 'relativePath required' }, { status: 400 })
  }

  const guard = resolveWithinRoot(relativePath)
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: 403 })
  }

  try {
    const result = await readMetadata(guard.abs)
    return NextResponse.json(result)
  } catch (e) {
    console.error('[files/metadata] error:', e)
    return NextResponse.json({ error: 'Failed to read metadata' }, { status: 500 })
  }
}
