import { NextRequest, NextResponse } from 'next/server'
import { consumePasswordResetToken, updatePassword, createSession, SESSION_COOKIE } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const { token, newPassword } = await req.json() as { token?: string; newPassword?: string }
  if (!token || !newPassword) {
    return NextResponse.json({ error: 'Token and password required' }, { status: 400 })
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const valid = await consumePasswordResetToken(token)
  if (!valid) {
    return NextResponse.json({ error: 'Reset link expired or already used' }, { status: 401 })
  }

  await updatePassword(newPassword)
  const sessionToken = await createSession()
  void logAction('auth:password_reset', 'Password changed via recovery code')

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
  })
  return res
}
