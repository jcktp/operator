import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { generateRecoveryCodes, saveRecoveryCodes, getRecoveryCodeStatus } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const status = await getRecoveryCodeStatus()
  return NextResponse.json(status)
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { codes, stored } = generateRecoveryCodes()
  await saveRecoveryCodes(stored)
  void logAction('auth:recovery_codes_generated', `${codes.length} new recovery codes generated`)
  return NextResponse.json({ codes })
}
