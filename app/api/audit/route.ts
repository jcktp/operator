import { NextResponse , NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { searchParams } = req.nextUrl
  const action = searchParams.get('action')
  const limit = Math.min(Number(searchParams.get('limit')) || 200, 1000)

  const logs = await prisma.auditLog.findMany({
    where: action ? { action } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json({ logs })
}
