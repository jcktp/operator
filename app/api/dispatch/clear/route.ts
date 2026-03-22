import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE() {
  await prisma.dispatchChat.deleteMany()
  return NextResponse.json({ ok: true })
}
