import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

export async function DELETE(req: NextRequest) {
  const authError = await requireAuth(req)
  if (authError) return authError
  await prisma.dispatchChat.deleteMany()
  return NextResponse.json({ ok: true })
}
