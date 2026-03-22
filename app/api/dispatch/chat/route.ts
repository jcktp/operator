import { NextRequest, NextResponse } from 'next/server'
import { dispatchChat } from '@/lib/ai'
import { loadAiSettings } from '@/lib/settings'

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json()
    await loadAiSettings()
    const content = await dispatchChat(messages, context)
    return NextResponse.json({ content })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
