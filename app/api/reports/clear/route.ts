import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logAction } from '@/lib/audit'

export async function DELETE() {
  const count = await prisma.report.count()
  await prisma.report.deleteMany()
  void logAction('report:clear', `All ${count} report${count !== 1 ? 's' : ''} permanently deleted`)
  return NextResponse.json({ ok: true })
}
