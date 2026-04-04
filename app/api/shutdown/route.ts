import { NextResponse , NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny
  // Invalidate the session token so the user must log in again on next startup
  try {
    await prisma.setting.updateMany({
      where: { key: 'auth_session_token' },
      data: { value: '' },
    })
  } catch { /* best effort */ }

  // Respond first, then exit so the client receives the response
  setTimeout(() => {
    process.exit(0)
  }, 600)

  return NextResponse.json({ ok: true })
}
