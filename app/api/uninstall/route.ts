import { NextRequest, NextResponse } from 'next/server'
import { triggerUninstall } from '@/lib/uninstall'
import { requireAuth } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  triggerUninstall()
  return NextResponse.json({ ok: true })
}
