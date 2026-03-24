import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ logs })
}
