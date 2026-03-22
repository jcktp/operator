import { NextRequest, NextResponse } from 'next/server'
import { isSetupComplete, setupAuth, SESSION_COOKIE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (await isSetupComplete()) {
    return NextResponse.json({ error: 'Already set up' }, { status: 400 })
  }

  const { name, role, password } = await req.json() as { name?: string; role?: string; password?: string }

  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const token = await setupAuth(name.trim(), role?.trim() ?? '', password)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
  return res
}
