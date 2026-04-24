import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { checkMonitor } from '@/lib/web-monitor'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  const changed = await checkMonitor(id)
  return NextResponse.json({ changed })
}
