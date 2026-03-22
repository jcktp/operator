import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SESSION_COOKIE } from '@/lib/auth'

export async function POST() {
  await prisma.setting.deleteMany({ where: { key: 'auth_session_token' } }).catch(() => {})
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(SESSION_COOKIE)
  return res
}
