import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const bookmarks = await prisma.browserBookmark.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ bookmarks })
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { url, title, favicon } = await req.json() as { url?: string; title?: string; favicon?: string }
  if (!url || !title) return NextResponse.json({ error: 'url and title required' }, { status: 400 })
  const bookmark = await prisma.browserBookmark.create({
    data: { url, title, favicon: favicon ?? null },
  })
  return NextResponse.json({ bookmark })
}

export async function DELETE(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await prisma.browserBookmark.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
