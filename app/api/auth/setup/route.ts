import { NextRequest, NextResponse } from 'next/server'
import { isSetupComplete, setupAuth, SESSION_COOKIE } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function POST(req: NextRequest) {
  if (await isSetupComplete()) {
    return NextResponse.json({ error: 'Already set up' }, { status: 400 })
  }

  const { name, role, password, appMode } = await req.json() as { name?: string; role?: string; password?: string; appMode?: string }

  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const token = await setupAuth(name.trim(), role?.trim() ?? '', password, appMode)

  void logAction('auth:setup', `Account created for ${name.trim()}`)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
  })
  return res
}
