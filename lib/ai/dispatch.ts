import { extractJsonFromText } from '../utils'
import { getModeConfig } from '../mode'
import { getPersonasForMode, type PersonaId } from '../personas'
import { chat, chatWithTools, chatWithToolsStream, type ChatResult } from '../ai-providers'
import { prisma } from '../db'

export type { ChatResult }

export async function dispatchChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: string,
  personaId: PersonaId = 'dispatch',
  userMemory = '',
  mode?: string
): Promise<ChatResult> {
  const personas = getPersonasForMode(mode ?? process.env.APP_MODE)
  const persona = personas[personaId]
  const webEnabled = process.env.OLLAMA_WEB_ACCESS === 'true'
  const dispatchProvider = process.env.AI_PROVIDER ?? 'ollama'
  const hasSearch: boolean | 'preemptive' = !webEnabled ? false : dispatchProvider === 'ollama' ? 'preemptive' : true
  const systemPrompt = persona.buildSystemPrompt(context, userMemory, hasSearch)
  return chatWithTools(messages, systemPrompt, persona.temperature)
}

export function dispatchChatStream(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: string,
  personaId: PersonaId = 'dispatch',
  userMemory = '',
  mode?: string
): ReadableStream<Uint8Array> {
  const resolvedMode = mode ?? process.env.APP_MODE ?? 'executive'
  const personas = getPersonasForMode(resolvedMode)
  const persona = personas[personaId]
  const webEnabled = process.env.OLLAMA_WEB_ACCESS === 'true'
  const provider = process.env.AI_PROVIDER ?? 'ollama'
  // For Ollama we execute web tools preemptively — tell the model about [LIVE DATA] blocks
  // instead of claiming it has callable tools (which confuses small models).
  const hasSearch: boolean | 'preemptive' = !webEnabled ? false : provider === 'ollama' ? 'preemptive' : true

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // Load global + mode-scoped glossary to enrich system prompt (best-effort)
      let enrichedMemory = userMemory
      try {
        const terms = await prisma.glossaryTerm.findMany({
          where: { scope: { in: ['global', `mode:${resolvedMode}`] } },
          orderBy: [{ scope: 'asc' }, { term: 'asc' }],
        })
        if (terms.length > 0) {
          const byScope: Record<string, string[]> = {}
          for (const t of terms) {
            const label = t.scope === 'global' ? 'Global' : t.scope.replace('mode:', '')
            byScope[label] = byScope[label] ?? []
            byScope[label].push(`${t.term} = ${t.definition}`)
          }
          const glossaryBlock = Object.entries(byScope)
            .map(([label, ts]) => `VOCABULARY — ${label}: ${ts.join(' | ')}`)
            .join('\n')
          enrichedMemory = enrichedMemory ? `${enrichedMemory}\n\n${glossaryBlock}` : glossaryBlock
        }
      } catch { /* non-blocking */ }

      const systemPrompt = persona.buildSystemPrompt(context, enrichedMemory, hasSearch)
      const innerStream = chatWithToolsStream(messages, systemPrompt, persona.temperature)
      const reader = innerStream.getReader()
      const dec = new TextDecoder()
      let buf = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        controller.enqueue(value)
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const ev = JSON.parse(line) as Record<string, unknown>
            if (ev.t === 'chunk') fullContent += ev.v as string
          } catch {}
        }
      }
      controller.close()

      // Background: extract new memory facts (fire and forget)
      extractMemoryFacts([...messages, { role: 'assistant', content: fullContent }], userMemory)
        .then(async newFacts => {
          if (newFacts.length === 0) return
          const existing = userMemory
          const updated = existing ? `${existing}\n${newFacts.join('\n')}` : newFacts.join('\n')
          await prisma.setting.upsert({
            where: { key: 'user_memory' },
            update: { value: updated },
            create: { id: crypto.randomUUID(), key: 'user_memory', value: updated },
          })
        })
        .catch(() => {})
    },
  })
}

export async function extractMemoryFacts(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  existingMemory: string
): Promise<string[]> {
  if (messages.length < 2) return []

  const recent = messages.slice(-6)
  const modeConfig = getModeConfig(undefined) // executive framing is fine for memory extraction
  const prompt = `You are reading a short conversation between a ${modeConfig.label.toLowerCase()} and an AI assistant. Extract any NEW facts about this person's work, goals, or preferences that would be useful to remember in future conversations.

Rules:
- Only extract concrete, specific facts (not vague observations)
- Only extract things NOT already in the existing memory
- Maximum 2 facts
- Each fact must be 1 short sentence
- If nothing new and concrete is worth remembering, return an empty array

Existing memory:
${existingMemory || '(none)'}

Conversation:
${recent.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 300)}`).join('\n')}

Reply with ONLY valid JSON: {"facts": ["fact 1", "fact 2"]} — or {"facts": []} if nothing new.`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
    const json = extractJsonFromText(text)
    const parsed = JSON.parse(json) as { facts?: unknown }
    if (!Array.isArray(parsed.facts)) return []
    return (parsed.facts as unknown[])
      .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      .slice(0, 2)
  } catch {
    return []
  }
}
