// ── Ollama streaming provider + tool helpers ─────────────────────────────────

import { Ollama } from 'ollama'
import { availableTools, hasNoteSaveIntent, executeTool, extractWeatherLocation } from '../ai-tools'
import type { Message } from './types'

// ── Tool helpers ─────────────────────────────────────────────────────────────

/** Extract save_to_journal args from conversation when the model hallucinated the tool call as text. */
export function extractSaveArgs(messages: Message[]): Record<string, string> | null {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUser) return null

  const titleMatch = lastUser.content.match(
    /(?:save(?:\s+(?:a\s+)?note)?(?:\s+(?:titled?|as|called?))?|titled?|called?)\s+["']?([A-Z][^"'\n]{2,80}?)["']?(?:\s*[.,]|\s*$)/i
  )

  const lastAI = [...messages].reverse().find(m => m.role === 'assistant')
  const bodyText = lastAI?.content || lastUser.content
  const content = bodyText
    .split(/\n\n+/)
    .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')

  const title = titleMatch?.[1]?.trim()
    || lastUser.content.replace(/^.*?(?:save|add|create).*?(?:about|on|for|called?)\s+/i, '').slice(0, 60).trim()
    || 'Note'

  return { title, content, folder: 'General' }
}

/** Detect when a small model narrates the tool call instead of making it. */
export function isHallucinatedToolCall(content: string): boolean {
  return /\[function:\s*save_to_journal\]|according to.*save_to_journal|save_to_journal.*cannot|cannot.*save_to_journal/i.test(content)
}

/**
 * Convert a conversational query into a better search string.
 * "what is going on in iran" → "iran latest news"
 */
export function buildSearchQuery(q: string): string {
  const geoMatch = q.match(/(?:going on|happening|news|updates?)\s+(?:in|about|with|for|around)\s+([A-Za-z][A-Za-z\s,'-]+?)(?:\?|$|\s+(?:right now|today|currently|now))/i)
  if (geoMatch) return `${geoMatch[1].trim()} latest news`

  if (/in the world|world(?:wide)?|globally|around the world/i.test(q)) return 'world news today'

  const aboutMatch = q.match(/(?:news|updates?|latest)\s+(?:about|on|regarding)\s+([A-Za-z][A-Za-z\s,'-]+?)(?:\?|$)/i)
  if (aboutMatch) return `${aboutMatch[1].trim()} news`

  const stripped = q.replace(/^(?:what(?:'s| is|'s)|tell me|can you|please|find|search for)\s+/i, '').slice(0, 120)
  return /\bnews\b/i.test(stripped) ? stripped : `${stripped} news today`
}

/**
 * Preemptive web tool execution for Ollama.
 * Small models can't reliably call tools via the API — we detect intent ourselves,
 * run the real tool, and return the result as injected context.
 */
export async function preemptiveWebTool(
  messages: Message[],
  onToolCall?: (name: string, input: Record<string, string>) => void,
): Promise<string | null> {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUser) return null
  const q = lastUser.content.trim()

  if (/\bweather\b|\btemperature\b|\bforecast\b/i.test(q)) {
    const location = extractWeatherLocation(messages)
    if (!location) return null
    onToolCall?.('get_weather', { location })
    return await executeTool('get_weather', { location }).catch(() => null)
  }

  const urlMatch = q.match(/https?:\/\/[^\s]+/)
  if (urlMatch) {
    const url = urlMatch[0]
    onToolCall?.('fetch_url', { url })
    return await executeTool('fetch_url', { url }).catch(() => null)
  }

  const isSearchIntent =
    /\b(news|current events|what(?:'s| is) (?:happening|going on)|what happened|latest|what.*today|right now|this week|search for|look up|find me|tell me about.*latest|according to the news|in the world|going on in|update[sd]? on)\b/i.test(q) &&
    !/\b(document|report|analysis|this file|attached|uploaded)\b/i.test(q)

  if (isSearchIntent) {
    const query = buildSearchQuery(q)
    onToolCall?.('search_web', { query })
    const result = await executeTool('search_web', { query }).catch(() => null)
    if (!result || /^No results found/i.test(result)) return null
    return result
  }

  return null
}

// ── Streaming chat ───────────────────────────────────────────────────────────

export async function chatOllamaStream(
  messages: Message[],
  systemPrompt: string,
  temperature: number,
  emit: (chunk: string) => void,
  onToolCall?: (name: string, input: Record<string, string>) => void,
): Promise<void> {
  const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
  const model = process.env.OLLAMA_MODEL ?? 'phi4-mini'
  const ollama = new Ollama({ host })
  const journalIntent = hasNoteSaveIntent(messages)

  // Right-size context window — avoids using the full model default (often 128k)
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0) + systemPrompt.length
  const promptTokens = Math.ceil(totalChars / 4)
  const num_ctx = Math.max(4096, Math.ceil((promptTokens + 2048) / 1024) * 1024)
  const noThink: Record<string, unknown> = { think: false }

  try {
    // ── PREEMPTIVE WEB TOOL EXECUTION ────────────────────────────────────────
    if (process.env.OLLAMA_WEB_ACCESS === 'true') {
      const lastUserContent = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''
      if (/\bweather\b|\btemperature\b|\bforecast\b/i.test(lastUserContent)) {
        const location = extractWeatherLocation(messages)
        if (!location) {
          emit("Which city would you like the weather for? For example: \"What's the weather in Amsterdam?\"")
          return
        }
      }

      const webResult = await preemptiveWebTool(messages, onToolCall)
      if (webResult !== null) {
        const enriched =
          systemPrompt +
          `\n\n[LIVE DATA — fetched now]:\n${webResult}\n\nUse the live data above to answer directly and accurately. Do not say you lack internet access or that you cannot retrieve real-time information.`
        const stream = await ollama.chat({
          model,
          messages: [{ role: 'system' as const, content: enriched }, ...messages],
          stream: true,
          options: { temperature, num_ctx, ...noThink },
        })
        for await (const chunk of stream) {
          if (chunk.message.content) emit(chunk.message.content)
        }
        return
      }
    }

    // ── JOURNAL SAVE / GENERAL CHAT ──────────────────────────────────────────
    const tools = availableTools(journalIntent).filter(
      t => !['get_weather', 'search_web', 'fetch_url'].includes(t.name)
    )
    const ollamaTools = tools.map(t => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }))
    const msgs = [{ role: 'system' as const, content: systemPrompt }, ...messages]

    for (let i = 0; i < 5; i++) {
      const buffer: string[] = []
      const streamEmit = journalIntent
        ? (chunk: string) => { buffer.push(chunk) }
        : emit

      const stream = await ollama.chat({
        model, messages: msgs, tools: ollamaTools,
        stream: true, options: { temperature, num_ctx, ...noThink },
      })
      let accContent = ''
      let finalToolCalls: Array<{ function: { name: string; arguments: unknown } }> | undefined

      for await (const chunk of stream) {
        if (chunk.message.content) {
          accContent += chunk.message.content
          streamEmit(chunk.message.content)
        }
        if (chunk.done) finalToolCalls = chunk.message.tool_calls
      }

      if (journalIntent && !finalToolCalls?.length && accContent && isHallucinatedToolCall(accContent)) {
        const saveArgs = extractSaveArgs(messages)
        if (saveArgs) {
          onToolCall?.('save_to_journal', saveArgs)
          const result = await executeTool('save_to_journal', saveArgs)
          emit(result.startsWith('Note saved') ? `✓ ${result}` : result)
        } else {
          emit('I wasn\'t able to save the note automatically. Please rephrase your request as: "Save a note titled [title] with this content: [content]"')
        }
        return
      }

      if (buffer.length) buffer.forEach(c => emit(c))

      if (finalToolCalls?.length) {
        msgs.push({ role: 'assistant', content: accContent })
        for (const tc of finalToolCalls) {
          const args = tc.function.arguments as Record<string, string>
          onToolCall?.(tc.function.name, args)
          const result = await executeTool(tc.function.name, args)
          msgs.push({ role: 'tool' as never, content: result })
        }
      } else if (accContent) {
        return
      } else {
        const fallback = await ollama.chat({ model, messages: msgs, options: { temperature, num_ctx, ...noThink } })
        if (fallback.message.content) emit(fallback.message.content)
        return
      }
    }
  } catch {
    const msgs = [{ role: 'system' as const, content: systemPrompt }, ...messages]
    const fallback = await ollama.chat({ model, messages: msgs, options: { temperature, num_ctx, ...noThink } })
    emit(fallback.message.content)
  }
}

// ── Simple chat (no tools) ───────────────────────────────────────────────────

export async function chatOllamaSimple(
  messages: Message[],
  temperature: number,
  jsonMode = false,
): Promise<string> {
  const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
  const model = process.env.OLLAMA_MODEL ?? 'phi4-mini'
  const ollama = new Ollama({ host })
  const noThink: Record<string, unknown> = { think: false }
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
  const promptTokens = Math.ceil(totalChars / 4)
  const num_ctx = Math.max(4096, Math.ceil((promptTokens + 2048) / 1024) * 1024)
  const response = await ollama.chat({
    model, messages,
    ...(jsonMode ? { format: 'json' as const } : {}),
    options: { temperature, num_ctx, ...noThink },
  })
  if (jsonMode && !response.message.content?.trim()) {
    const retry = await ollama.chat({ model, messages, options: { temperature, num_ctx, ...noThink } })
    return retry.message.content
  }
  return response.message.content
}
