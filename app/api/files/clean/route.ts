import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { resolveWithinRoot, runMat2, runExifToolStrip } from '@/lib/file-cleaner'

export const dynamic = 'force-dynamic'

type Tool = 'mat2' | 'exiftool'
const ALLOWED_TOOLS = new Set<Tool>(['mat2', 'exiftool'])

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const body = await req.json() as { relativePath?: string; tool?: string }
  const { relativePath, tool } = body

  if (!relativePath) {
    return NextResponse.json({ error: 'relativePath required' }, { status: 400 })
  }

  if (!tool || !ALLOWED_TOOLS.has(tool as Tool)) {
    return NextResponse.json({ error: 'tool must be "mat2" or "exiftool"' }, { status: 400 })
  }

  const guard = resolveWithinRoot(relativePath)
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: 403 })
  }

  try {
    const result = tool === 'mat2'
      ? await runMat2(guard.abs, guard.root)
      : await runExifToolStrip(guard.abs, guard.root)

    return NextResponse.json({ cleanedRelativePath: result.cleanedRelative })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[files/clean] error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
