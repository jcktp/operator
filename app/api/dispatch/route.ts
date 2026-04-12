import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { errorResponse } from '@/lib/api-error'

export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const chats = await prisma.dispatchChat.findMany({
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json({ chats })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const { title, messages } = await req.json()
    const chat = await prisma.dispatchChat.create({
      data: { title: title || 'Untitled chat', messages: JSON.stringify(messages ?? []) },
    })
    return NextResponse.json({ chat })
  } catch (e) {
    return errorResponse(e)
  }
}
