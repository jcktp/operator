import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPassword, createSession, getFailedAttempts, SESSION_COOKIE, MAX_ATTEMPTS } from '@/lib/auth'
import { triggerUninstall } from '@/lib/uninstall'

export async function POST(req: NextRequest) {
  const { password } = await req.json() as { password?: string }

  const rows = await prisma.setting.findMany({
    where: { key: { in: ['auth_password_hash', 'auth_setup_complete'] } },
  })
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]))

  if (s.auth_setup_complete !== 'true') {
    return NextResponse.json({ error: 'Not set up' }, { status: 400 })
  }

  const attempts = await getFailedAttempts()

  // Already hit the limit from a previous session
  if (attempts >= MAX_ATTEMPTS) {
    triggerUninstall()
    return NextResponse.json({ error: 'Maximum attempts exceeded. Operator is being uninstalled.', uninstalled: true }, { status: 403 })
  }

  const valid = password ? verifyPassword(password, s.auth_password_hash ?? '') : false

  if (!valid) {
    const newAttempts = attempts + 1
    await prisma.setting.upsert({
      where: { key: 'auth_failed_attempts' },
      update: { value: String(newAttempts) },
      create: { id: crypto.randomUUID(), key: 'auth_failed_attempts', value: String(newAttempts) },
    })

    if (newAttempts >= MAX_ATTEMPTS) {
      // Trigger uninstall after a brief delay so this response is sent first
      setTimeout(() => triggerUninstall(), 500)
      return NextResponse.json({
        error: 'Incorrect password. Maximum attempts reached — Operator is being permanently deleted.',
        uninstalled: true,
      }, { status: 403 })
    }

    const left = MAX_ATTEMPTS - newAttempts
    return NextResponse.json({
      error: `Incorrect password. ${left} attempt${left !== 1 ? 's' : ''} remaining before permanent deletion.`,
      attemptsLeft: left,
    }, { status: 401 })
  }

  // Success
  const token = await createSession()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
