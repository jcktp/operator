import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  const { title, messages } = await req.json()
  const chat = await prisma.dispatchChat.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(messages !== undefined ? { messages: JSON.stringify(messages) } : {}),
    },
  })
  return NextResponse.json({ chat })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  await prisma.dispatchChat.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
