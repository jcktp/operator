import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { dispatchChat } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json()

    // Load AI provider settings
    const settings = await prisma.setting.findMany()
    for (const s of settings) {
      if (s.key === 'ollama_host')     process.env.OLLAMA_HOST = s.value
      if (s.key === 'ollama_model')    process.env.OLLAMA_MODEL = s.value
      if (s.key === 'ai_provider')     process.env.AI_PROVIDER = s.value
      if (s.key === 'anthropic_key')   process.env.ANTHROPIC_API_KEY = s.value
      if (s.key === 'openai_key')      process.env.OPENAI_API_KEY = s.value
      if (s.key === 'google_key')      process.env.GOOGLE_API_KEY = s.value
      if (s.key === 'groq_key')        process.env.GROQ_API_KEY = s.value
      if (s.key === 'anthropic_model') process.env.ANTHROPIC_MODEL = s.value
      if (s.key === 'openai_model')    process.env.OPENAI_MODEL = s.value
      if (s.key === 'google_model')    process.env.GOOGLE_MODEL = s.value
      if (s.key === 'groq_model')      process.env.GROQ_MODEL = s.value
    }

    const content = await dispatchChat(messages, context)
    return NextResponse.json({ content })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
