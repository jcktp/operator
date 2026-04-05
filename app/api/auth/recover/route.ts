import { NextRequest, NextResponse } from 'next/server'
import { validateAndConsumeRecoveryCode, createPasswordResetToken } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const { code } = await req.json() as { code?: string }
  if (!code?.trim()) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const valid = await validateAndConsumeRecoveryCode(code.trim())
  if (!valid) {
    return NextResponse.json({ error: 'Invalid or already-used recovery code' }, { status: 401 })
  }

  const resetToken = await createPasswordResetToken()
  void logAction('auth:recovery_code_used', 'Password reset initiated via recovery code')
  return NextResponse.json({ resetToken })
}
