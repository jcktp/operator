import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const chats = await prisma.dispatchChat.findMany({
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json({ chats })
}

export async function POST(req: NextRequest) {
  const { title, messages } = await req.json()
  const chat = await prisma.dispatchChat.create({
    data: { title: title || 'Untitled chat', messages: JSON.stringify(messages ?? []) },
  })
  return NextResponse.json({ chat })
}
