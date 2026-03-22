import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.dispatchChat.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
