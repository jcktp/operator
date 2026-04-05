import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { getProvider } from '@/lib/ai-providers'
import { getSecret } from '@/lib/settings'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { question, projectId } = await req.json() as { question: string; projectId?: string | null }
  if (!question?.trim()) return NextResponse.json({ error: 'question required' }, { status: 400 })

  const projectFilter = projectId ? { report: { projectId } } : {}

  // Gather context: entities + timeline events + report titles
  const [entities, events, reports] = await Promise.all([
    prisma.reportEntity.findMany({
      where: projectId ? { report: { projectId } } : {},
      select: { name: true, type: true, reportId: true },
      orderBy: { createdAt: 'desc' },
      take: 300,
    }),
    prisma.timelineEvent.findMany({
      where: projectId ? { report: { projectId } } : {},
      select: { dateText: true, event: true, report: { select: { id: true, title: true } } },
      orderBy: [{ dateSortKey: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    }),
    prisma.report.findMany({
      where: projectId ? { projectId } : {},
      select: { id: true, title: true, area: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ])

  // Count entity mentions
  const entityCounts = new Map<string, { type: string; count: number }>()
  for (const e of entities) {
    const key = `${e.name}|${e.type}`
    const existing = entityCounts.get(key)
    if (existing) {
      existing.count++
    } else {
      entityCounts.set(key, { type: e.type, count: 1 })
    }
  }

  // Build compact context string
  const topEntities = [...entityCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 60)
    .map(([nameType, d]) => {
      const [name] = nameType.split('|')
      return `${name} (${d.type}, ${d.count}x)`
    })
    .join(', ')

  const timelineContext = events
    .map(e => `[${e.dateText}] ${e.event} — source: "${e.report.title}" (${e.report.id})`)
    .join('\n')

  const reportList = reports
    .map(r => `${r.id} | ${r.title} | ${r.area}`)
    .join('\n')

  const systemPrompt = `You are an intelligence analyst assistant. Answer questions concisely based on the provided data.
Always cite specific report IDs when referencing sources. Keep answers under 120 words.
Format: 1–3 sentences of direct answer, then a short "Sources:" line listing report IDs that are most relevant.
If asked how many times something appears, give the exact count from the data.`

  const userPrompt = `Question: ${question}

ENTITIES (name, type, mention count):
${topEntities}

TIMELINE EVENTS:
${timelineContext.slice(0, 8000)}

REPORTS:
${reportList.slice(0, 2000)}`

  const provider = getProvider()

  try {
    let answer = ''

    if (provider === 'ollama') {
      const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
      const model = process.env.OLLAMA_MODEL ?? 'phi4-mini'
      const res = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
        }),
      })
      if (!res.ok) throw new Error(`Ollama ${res.status}`)
      const data = await res.json() as { message?: { content?: string } }
      answer = data.message?.content?.trim() ?? ''

    } else if (provider === 'anthropic') {
      const key = getSecret('ANTHROPIC_API_KEY')
      if (!key) throw new Error('Anthropic key not set')
      const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 300, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
      })
      if (!res.ok) throw new Error(`Anthropic ${res.status}`)
      const data = await res.json() as { content?: Array<{ text?: string }> }
      answer = data.content?.[0]?.text?.trim() ?? ''

    } else if (provider === 'openai') {
      const key = getSecret('OPENAI_API_KEY')
      if (!key) throw new Error('OpenAI key not set')
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 300, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] }),
      })
      if (!res.ok) throw new Error(`OpenAI ${res.status}`)
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
      answer = data.choices?.[0]?.message?.content?.trim() ?? ''

    } else if (provider === 'google') {
      const key = getSecret('GOOGLE_API_KEY')
      if (!key) throw new Error('Google key not set')
      const model = process.env.GOOGLE_MODEL ?? 'gemini-2.5-flash'
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }], generationConfig: { maxOutputTokens: 300 } }),
      })
      if (!res.ok) throw new Error(`Google ${res.status}`)
      const data = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> }
      answer = data.candidates?.[0]?.content.parts[0]?.text?.trim() ?? ''

    } else {
      return NextResponse.json({ error: `Provider "${provider}" does not support entity queries` }, { status: 422 })
    }

    // Extract any report IDs mentioned in the answer to surface as links
    const mentionedIds = reports
      .filter(r => answer.includes(r.id))
      .map(r => ({ id: r.id, title: r.title }))

    return NextResponse.json({ answer, sources: mentionedIds })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
