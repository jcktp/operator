import { Ollama } from 'ollama'
import { availableTools, hasNoteSaveIntent, executeTool, getNoteSaved, resetNoteSaved, extractWeatherLocation } from './ai-tools'
import { getSecret } from './settings'

// ── Provider types ──────────────────────────────────────────────────────────

export type AIProvider = 'ollama' | 'anthropic' | 'openai' | 'google' | 'groq' | 'xai' | 'perplexity' | 'mistral'

export function getProvider(): AIProvider {
  return (process.env.AI_PROVIDER as AIProvider) ?? 'ollama'
}

export function maxContentLength(): number {
  // Cloud models (Claude, GPT-4o, Gemini) have 128k–1M token windows.
  // Ollama: derive from the model's context window via model-capabilities.
  if (getProvider() !== 'ollama') return 100_000
  // Lazy import to avoid circular deps — model-capabilities doesn't import ai-providers
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { maxCharsForModel } = require('./model-capabilities') as typeof import('./model-capabilities')
  return maxCharsForModel(process.env.OLLAMA_MODEL ?? 'phi4-mini')
}

// ── Message types ───────────────────────────────────────────────────────────

export interface Message { role: 'user' | 'assistant'; content: string }
export interface ChatResult { content: string; noteSaved?: { title: string; folder: string } }

// ── Retry helper (fix #7) ───────────────────────────────────────────────────

async function fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, init)
      if ((res.status === 429 || res.status >= 500) && i < maxAttempts - 1) {
        const retryAfter = res.headers.get('Retry-After')
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000 * 2 ** i
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      return res
    } catch (e) {
      lastErr = e
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, 1000 * 2 ** i))
    }
  }
  throw lastErr ?? new Error('fetch failed after retries')
}

// ── SSE line iterator ────────────────────────────────────────────────────────

async function* sseLines(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) yield line
  }
  if (buf) yield buf
}

// ── Anthropic streaming ─────────────────────────────────────────────────────

interface AnthropicStreamResult {
  toolBlocks: Array<{ id: string; name: string; input: Record<string, string> }>
  allBlocks: unknown[]
}

async function streamAnthropic(
  messages: unknown[],
  system: string,
  temperature: number,
  tools: unknown[],
  key: string,
  model: string,
  onChunk: (text: string) => void,
): Promise<AnthropicStreamResult> {
  const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 2048, temperature, system, messages, tools, stream: true }),
  })
  if (!res.ok) {
    const err = await res.json() as { error?: { message: string } }
    throw new Error(err.error?.message ?? `Anthropic error ${res.status}`)
  }

  let currentType = ''
  let currentId = ''
  let currentName = ''
  let currentInputJson = ''
  let currentTextAcc = ''
  const allBlocks: unknown[] = []
  const toolBlocks: Array<{ id: string; name: string; input: Record<string, string> }> = []

  for await (const line of sseLines(res)) {
    if (!line.startsWith('data: ')) continue
    const data = line.slice(6).trim()
    if (!data || data === '[DONE]') continue
    let ev: Record<string, unknown>
    try { ev = JSON.parse(data) } catch { continue }

    if (ev.type === 'content_block_start') {
      const block = ev.content_block as Record<string, unknown>
      currentType = block.type as string
      currentTextAcc = ''
      currentInputJson = ''
      if (currentType === 'tool_use') {
        currentId = block.id as string
        currentName = block.name as string
      }
    } else if (ev.type === 'content_block_delta') {
      const delta = ev.delta as Record<string, unknown>
      if (currentType === 'text' && delta.type === 'text_delta') {
        const t = delta.text as string
        currentTextAcc += t
        onChunk(t)
      } else if (currentType === 'tool_use' && delta.type === 'input_json_delta') {
        currentInputJson += (delta.partial_json as string) ?? ''
      }
    } else if (ev.type === 'content_block_stop') {
      if (currentType === 'text') {
        allBlocks.push({ type: 'text', text: currentTextAcc })
      } else if (currentType === 'tool_use') {
        let input: Record<string, string> = {}
        try { input = JSON.parse(currentInputJson || '{}') } catch {}
        const block = { type: 'tool_use', id: currentId, name: currentName, input }
        allBlocks.push(block)
        toolBlocks.push({ id: currentId, name: currentName, input })
      }
    }
  }

  return { toolBlocks, allBlocks }
}

async function chatAnthropicStream(
  messages: Message[],
  systemPrompt: string,
  temperature: number,
  emit: (chunk: string) => void,
  onToolCall?: (name: string, input: Record<string, string>) => void,
): Promise<void> {
  const key = getSecret('ANTHROPIC_API_KEY')
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
  const tools = availableTools()
  const anthropicTools = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }))

  type AntMsg = { role: string; content: string | unknown[] }
  const msgs: AntMsg[] = messages.map(m => ({ role: m.role, content: m.content }))

  for (let i = 0; i < 5; i++) {
    const { toolBlocks, allBlocks } = await streamAnthropic(msgs, systemPrompt, temperature, anthropicTools, key, model, emit)
    if (toolBlocks.length > 0) {
      msgs.push({ role: 'assistant', content: allBlocks })
      const results = await Promise.all(
        toolBlocks.map(async b => {
          onToolCall?.(b.name, b.input)
          return { type: 'tool_result', tool_use_id: b.id, content: await executeTool(b.name, b.input) }
        })
      )
      msgs.push({ role: 'user', content: results })
    } else {
      return
    }
  }
}

// ── OpenAI-compatible streaming ─────────────────────────────────────────────

interface OpenAIStreamResult {
  toolCalls: Array<{ id: string; name: string; args: string }>
  finishReason: string
}

async function streamOpenAI(
  messages: unknown[],
  temperature: number,
  endpoint: string,
  apiKey: string,
  model: string,
  tools: unknown[],
  onChunk: (text: string) => void,
): Promise<OpenAIStreamResult> {
  const body: Record<string, unknown> = { model, messages, temperature, stream: true }
  if (tools.length > 0) { body.tools = tools; body.tool_choice = 'auto' }

  const res = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json() as { error?: { message: string } }
    throw new Error(err.error?.message ?? `API error ${res.status}`)
  }

  let finishReason = ''
  const tcMap = new Map<number, { id: string; name: string; args: string }>()

  for await (const line of sseLines(res)) {
    if (!line.startsWith('data: ')) continue
    const data = line.slice(6).trim()
    if (!data || data === '[DONE]') continue
    let chunk: Record<string, unknown>
    try { chunk = JSON.parse(data) } catch { continue }
    const choice = (chunk.choices as unknown[])?.[0] as Record<string, unknown> | undefined
    if (!choice) continue
    if (choice.finish_reason) finishReason = choice.finish_reason as string
    const delta = choice.delta as Record<string, unknown> | undefined
    if (!delta) continue
    if (typeof delta.content === 'string' && delta.content) onChunk(delta.content)
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls as Record<string, unknown>[]) {
        const idx = tc.index as number
        if (!tcMap.has(idx)) tcMap.set(idx, { id: '', name: '', args: '' })
        const entry = tcMap.get(idx)!
        if (tc.id) entry.id = tc.id as string
        const fn = tc.function as Record<string, string> | undefined
        if (fn?.name) entry.name += fn.name
        if (fn?.arguments) entry.args += fn.arguments
      }
    }
  }

  return { toolCalls: Array.from(tcMap.values()), finishReason }
}

async function chatOpenAIStream(
  messages: Message[],
  systemPrompt: string,
  temperature: number,
  endpoint: string,
  apiKey: string,
  model: string,
  skipTools: boolean,
  emit: (chunk: string) => void,
  onToolCall?: (name: string, input: Record<string, string>) => void,
): Promise<void> {
  if (!apiKey) throw new Error(`API key not set for ${endpoint}`)
  const tools = skipTools ? [] : availableTools().map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))

  type OAIMsg = { role: string; content?: string | null; tool_calls?: unknown[]; tool_call_id?: string }
  const msgs: OAIMsg[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ]

  for (let i = 0; i < 5; i++) {
    const { toolCalls, finishReason } = await streamOpenAI(msgs, temperature, endpoint, apiKey, model, tools, emit)
    if (finishReason === 'tool_calls' && toolCalls.length > 0) {
      msgs.push({
        role: 'assistant', content: null,
        tool_calls: toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args } })),
      })
      const results = await Promise.all(
        toolCalls.map(async tc => {
          let args: Record<string, string> = {}
          try { args = JSON.parse(tc.args || '{}') } catch {}
          onToolCall?.(tc.name, args)
          return { role: 'tool', tool_call_id: tc.id, content: await executeTool(tc.name, args) } as OAIMsg
        })
      )
      msgs.push(...results)
    } else {
      return
    }
  }
}

// ── Google streaming (non-streaming internally, single emit) ────────────────

async function chatGoogleStream(
  messages: Message[],
  systemPrompt: string,
  temperature: number,
  emit: (chunk: string) => void,
  onToolCall?: (name: string, input: Record<string, string>) => void,
): Promise<void> {
  const key = getSecret('GOOGLE_API_KEY')
  if (!key) throw new Error('GOOGLE_API_KEY not set')
  const model = process.env.GOOGLE_MODEL ?? 'gemini-2.5-flash'
  const tools = availableTools()
  const functionDeclarations = tools.map(t => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: 'OBJECT',
      properties: Object.fromEntries(
        Object.entries(t.parameters.properties).map(([k, v]) => [k, { type: 'STRING', description: (v as { description: string }).description }])
      ),
      required: t.parameters.required,
    },
  }))

  type GPart = { text?: string; functionCall?: { name: string; args: Record<string, string> }; functionResponse?: { name: string; response: { content: string } } }
  type GContent = { role: string; parts: GPart[] }

  const contents: GContent[] = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood.' }] },
    ...messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
  ]

  for (let i = 0; i < 5; i++) {
    const res = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, tools: [{ function_declarations: functionDeclarations }], generationConfig: { temperature } }),
      }
    )
    const data = await res.json() as {
      candidates?: Array<{ content: GContent }>
      error?: { message: string }
    }
    if (!res.ok) throw new Error(data.error?.message ?? 'Google error')
    const candidate = data.candidates?.[0]
    if (!candidate) throw new Error('No response from Google')
    const parts = candidate.content.parts
    const funcCall = parts.find(p => p.functionCall)
    if (funcCall?.functionCall) {
      contents.push({ role: 'model', parts })
      onToolCall?.(funcCall.functionCall.name, funcCall.functionCall.args)
      const result = await executeTool(funcCall.functionCall.name, funcCall.functionCall.args)
      contents.push({ role: 'user', parts: [{ functionResponse: { name: funcCall.functionCall.name, response: { content: result } } }] })
    } else {
      emit(parts.map(p => p.text ?? '').join(''))
      return
    }
  }
}

// ── Ollama streaming ────────────────────────────────────────────────────────

// Extract save_to_journal args from conversation history when the model hallucinated
// the tool call as text instead of actually calling it.
function extractSaveArgs(messages: Message[]): Record<string, string> | null {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUser) return null

  // Try to pull an explicit title from phrases like "save as X", "titled X", "called X"
  const titleMatch = lastUser.content.match(
    /(?:save(?:\s+(?:a\s+)?note)?(?:\s+(?:titled?|as|called?))?|titled?|called?)\s+["']?([A-Z][^"'\n]{2,80}?)["']?(?:\s*[.,]|\s*$)/i
  )

  // Use the last assistant message body as the note content (it has the actual analysis)
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

// Detect when a small model narrates the tool call instead of making it
function isHallucinatedToolCall(content: string): boolean {
  return /\[function:\s*save_to_journal\]|according to.*save_to_journal|save_to_journal.*cannot|cannot.*save_to_journal/i.test(content)
}

/**
 * Preemptive web tool execution for Ollama.
 *
 * Small models (phi4-mini etc.) can't reliably call tools via the API — they
 * either hallucinate fake results or refuse ("I don't have internet access").
 * Instead of passing tool definitions to the model, we detect intent ourselves,
 * run the real tool, and return the result so the caller can inject it as context.
 *
 * Returns the tool result string if a tool was executed, null if no web intent
 * was detected (caller falls through to normal chat).
 */
async function preemptiveWebTool(
  messages: Message[],
  onToolCall?: (name: string, input: Record<string, string>) => void,
): Promise<string | null> {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUser) return null
  const q = lastUser.content.trim()

  // Weather intent
  if (/\bweather\b|\btemperature\b|\bforecast\b/i.test(q)) {
    const location = extractWeatherLocation(messages)
    if (!location) return null // No location — let model ask for clarification
    onToolCall?.('get_weather', { location })
    return await executeTool('get_weather', { location }).catch(() => null)
  }

  // Explicit URL → fetch it
  const urlMatch = q.match(/https?:\/\/[^\s]+/)
  if (urlMatch) {
    const url = urlMatch[0]
    onToolCall?.('fetch_url', { url })
    return await executeTool('fetch_url', { url }).catch(() => null)
  }

  // News / current-events / search intent
  // Positive signals: asking for real-time info, news, facts that require web
  // Negative signals: asking about documents/reports already uploaded
  const isSearchIntent =
    /\b(news|current events|what(?:'s| is) (?:happening|going on)|what happened|latest|what.*today|right now|this week|search for|look up|find me|tell me about.*latest|according to the news|in the world|going on in|update[sd]? on)\b/i.test(q) &&
    !/\b(document|report|analysis|this file|attached|uploaded)\b/i.test(q)

  if (isSearchIntent) {
    const query = buildSearchQuery(q)
    onToolCall?.('search_web', { query })
    const result = await executeTool('search_web', { query }).catch(() => null)
    // If DuckDuckGo returned nothing useful, don't inject empty context —
    // return null so the model answers from training rather than saying "no data".
    if (!result || /^No results found/i.test(result)) return null
    return result
  }

  return null
}

/**
 * Convert a conversational query into a better search string.
 * "what is going on in iran" → "iran latest news"
 * "what's happening in france" → "france latest news"
 * "what is going on in the world" → "world news today"
 */
function buildSearchQuery(q: string): string {
  // "what is going on / happening in X" → "X latest news"
  const geoMatch = q.match(/(?:going on|happening|news|updates?)\s+(?:in|about|with|for|around)\s+([A-Za-z][A-Za-z\s,'-]+?)(?:\?|$|\s+(?:right now|today|currently|now))/i)
  if (geoMatch) return `${geoMatch[1].trim()} latest news`

  // "what is going on in the world" / "world news"
  if (/in the world|world(?:wide)?|globally|around the world/i.test(q)) return 'world news today'

  // "latest news about X" / "updates on X"
  const aboutMatch = q.match(/(?:news|updates?|latest)\s+(?:about|on|regarding)\s+([A-Za-z][A-Za-z\s,'-]+?)(?:\?|$)/i)
  if (aboutMatch) return `${aboutMatch[1].trim()} news`

  // Generic: strip question words, append "news" if not present
  const stripped = q.replace(/^(?:what(?:'s| is|'s)|tell me|can you|please|find|search for)\s+/i, '').slice(0, 120)
  return /\bnews\b/i.test(stripped) ? stripped : `${stripped} news today`
}

async function chatOllamaStream(
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

  try {
    // ── PREEMPTIVE WEB TOOL EXECUTION ────────────────────────────────────────
    // Run web tools before calling the model so small models never need to
    // invoke them — real data is injected as context instead.
    if (process.env.OLLAMA_WEB_ACCESS === 'true') {
      // Weather query with no location → ask user directly (don't let the model say "I can't browse")
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
          options: { temperature },
        })
        for await (const chunk of stream) {
          if (chunk.message.content) emit(chunk.message.content)
        }
        return
      }
    }

    // ── JOURNAL SAVE / GENERAL CHAT ──────────────────────────────────────────
    // For Ollama we only pass the journal tool — web tools are handled
    // preemptively above and should never be passed to small models.
    const tools = availableTools(journalIntent).filter(
      t => !['get_weather', 'search_web', 'fetch_url'].includes(t.name)
    )
    const ollamaTools = tools.map(t => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }))
    const msgs = [{ role: 'system' as const, content: systemPrompt }, ...messages]

    for (let i = 0; i < 5; i++) {
      // When journal save intent is present, buffer first — small models like
      // phi4-mini sometimes narrate the function call as text instead of calling
      // it. We detect that after the full response and handle it before emitting.
      const buffer: string[] = []
      const streamEmit = journalIntent
        ? (chunk: string) => { buffer.push(chunk) }
        : emit

      const stream = await ollama.chat({
        model, messages: msgs, tools: ollamaTools,
        stream: true, options: { temperature },
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

      // Detect hallucinated tool call: model narrated the function instead of calling it.
      // Extract title + content from the conversation and actually execute the save.
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

      // Flush buffer for normal buffered responses
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
        // Model returned no tool calls and no content — small models often
        // fail to synthesise a response after tool results. Do one explicit
        // non-streaming follow-up without tools so the model just answers.
        const fallback = await ollama.chat({ model, messages: msgs, options: { temperature } })
        if (fallback.message.content) emit(fallback.message.content)
        return
      }
    }
  } catch {
    // Fallback to non-streaming
    const msgs = [{ role: 'system' as const, content: systemPrompt }, ...messages]
    const fallback = await ollama.chat({ model, messages: msgs, options: { temperature } })
    emit(fallback.message.content)
  }
}

// ── chatWithToolsStream (fix #1, #5) ────────────────────────────────────────

export function chatWithToolsStream(
  messages: Message[],
  systemPrompt: string,
  temperature: number,
): ReadableStream<Uint8Array> {
  const provider = getProvider()
  const enc = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (obj: Record<string, unknown>) =>
        controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'))

      // fix #1: air-gap check applies to chatWithTools too
      if (process.env.AIR_GAP_MODE === 'true' && provider !== 'ollama') {
        enqueue({ t: 'error', error: 'Air-gap mode is enabled — cloud AI providers are blocked. Switch to Ollama in Settings.' })
        controller.close()
        return
      }

      resetNoteSaved()
      const emit = (text: string) => { if (text) enqueue({ t: 'chunk', v: text }) }
      const onToolCall = (name: string, input: Record<string, string>) => {
        enqueue({ t: 'tool', name, query: input.query ?? '' })
      }

      try {
        switch (provider) {
          case 'anthropic':
            await chatAnthropicStream(messages, systemPrompt, temperature, emit, onToolCall)
            break
          case 'openai':
            await chatOpenAIStream(messages, systemPrompt, temperature, 'https://api.openai.com/v1/chat/completions', getSecret('OPENAI_API_KEY') ?? '', process.env.OPENAI_MODEL ?? 'gpt-4o-mini', false, emit, onToolCall)
            break
          case 'groq':
            await chatOpenAIStream(messages, systemPrompt, temperature, 'https://api.groq.com/openai/v1/chat/completions', getSecret('GROQ_API_KEY') ?? '', process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant', false, emit, onToolCall)
            break
          case 'google':
            await chatGoogleStream(messages, systemPrompt, temperature, emit, onToolCall)
            break
          case 'xai':
            await chatOpenAIStream(messages, systemPrompt, temperature, 'https://api.x.ai/v1/chat/completions', getSecret('XAI_API_KEY') ?? '', process.env.XAI_MODEL ?? 'grok-3-mini', false, emit, onToolCall)
            break
          case 'perplexity':
            await chatOpenAIStream(messages, systemPrompt, temperature, 'https://api.perplexity.ai/chat/completions', getSecret('PERPLEXITY_API_KEY') ?? '', process.env.PERPLEXITY_MODEL ?? 'llama-3.1-sonar-small-128k-online', true, emit, onToolCall)
            break
          case 'mistral':
            await chatOpenAIStream(messages, systemPrompt, temperature, 'https://api.mistral.ai/v1/chat/completions', getSecret('MISTRAL_API_KEY') ?? '', process.env.MISTRAL_MODEL ?? 'mistral-small-latest', false, emit, onToolCall)
            break
          default:
            await chatOllamaStream(messages, systemPrompt, temperature, emit, onToolCall)
        }
        const noteSaved = getNoteSaved()
        enqueue({ t: 'done', noteSaved: noteSaved ?? null })
      } catch (e) {
        enqueue({ t: 'error', error: e instanceof Error ? e.message : String(e) })
      } finally {
        controller.close()
      }
    },
  })
}

// ── chatWithTools (backward compat — collects the stream) ────────────────────

export async function chatWithTools(
  messages: Message[],
  systemPrompt: string,
  temperature = 0.3,
): Promise<ChatResult> {
  const stream = chatWithToolsStream(messages, systemPrompt, temperature)
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let content = ''
  let noteSaved: { title: string; folder: string } | undefined
  let streamError: string | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      let ev: Record<string, unknown>
      try { ev = JSON.parse(line) } catch { continue }
      if (ev.t === 'chunk') content += ev.v as string
      else if (ev.t === 'done') noteSaved = (ev.noteSaved as { title: string; folder: string } | null) ?? undefined
      else if (ev.t === 'error') { streamError = ev.error as string; break }
    }
    if (streamError) break
  }
  reader.cancel().catch(() => {})
  if (streamError) throw new Error(streamError)
  return { content, noteSaved }
}

// ── Simple chat (no tools) ───────────────────────────────────────────────────

// fix #2: shared helper for all OpenAI-compatible providers — eliminates
// the five near-identical fetch blocks that existed in the old chat() function.
async function chatOpenAISimple(
  messages: Message[],
  temperature: number,
  endpoint: string,
  apiKey: string,
  model: string,
  jsonMode = false,
): Promise<string> {
  if (!apiKey) throw new Error(`API key not set for ${endpoint}`)
  const body: Record<string, unknown> = { model, messages, temperature }
  if (jsonMode) body.response_format = { type: 'json_object' }
  const res = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } }
  if (!res.ok) throw new Error(data.error?.message ?? 'API error')
  return data.choices?.[0]?.message.content ?? ''
}

export async function chat(messages: Message[], temperature = 0.1, jsonMode = false): Promise<string> {
  const provider = getProvider()
  if (process.env.AIR_GAP_MODE === 'true' && provider !== 'ollama') {
    throw new Error('Air-gap mode is enabled — cloud AI providers are blocked. Switch to Ollama in Settings.')
  }
  switch (provider) {
    case 'anthropic': {
      const key = getSecret('ANTHROPIC_API_KEY')
      if (!key) throw new Error('ANTHROPIC_API_KEY not set')
      const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
      const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 2048, temperature, messages }),
      })
      const data = await res.json() as { content?: Array<{ text: string }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message ?? 'Anthropic error')
      return data.content?.[0]?.text ?? ''
    }
    // fix #2: OpenAI-compatible providers share one implementation
    case 'openai':
      return chatOpenAISimple(messages, temperature, 'https://api.openai.com/v1/chat/completions', getSecret('OPENAI_API_KEY') ?? '', process.env.OPENAI_MODEL ?? 'gpt-4o-mini', jsonMode)
    case 'groq':
      return chatOpenAISimple(messages, temperature, 'https://api.groq.com/openai/v1/chat/completions', getSecret('GROQ_API_KEY') ?? '', process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile', jsonMode)
    case 'xai':
      return chatOpenAISimple(messages, temperature, 'https://api.x.ai/v1/chat/completions', getSecret('XAI_API_KEY') ?? '', process.env.XAI_MODEL ?? 'grok-3-mini', jsonMode)
    case 'perplexity':
      return chatOpenAISimple(messages, temperature, 'https://api.perplexity.ai/chat/completions', getSecret('PERPLEXITY_API_KEY') ?? '', process.env.PERPLEXITY_MODEL ?? 'llama-3.1-sonar-small-128k-online', false)
    case 'mistral':
      return chatOpenAISimple(messages, temperature, 'https://api.mistral.ai/v1/chat/completions', getSecret('MISTRAL_API_KEY') ?? '', process.env.MISTRAL_MODEL ?? 'mistral-small-latest', jsonMode)
    case 'google': {
      const key = getSecret('GOOGLE_API_KEY')
      if (!key) throw new Error('GOOGLE_API_KEY not set')
      const model = process.env.GOOGLE_MODEL ?? 'gemini-2.5-flash'
      // fix #3: proper multi-turn format — preserves role info instead of joining all content
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))
      const res = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: { temperature, ...(jsonMode ? { responseMimeType: 'application/json' } : {}) },
          }),
        }
      )
      const data = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message ?? 'Google error')
      return data.candidates?.[0]?.content.parts[0]?.text ?? ''
    }
    default: {
      const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
      const model = process.env.OLLAMA_MODEL ?? 'phi4-mini'
      const ollama = new Ollama({ host })
      // think: false disables qwen3's extended chain-of-thought mode, which can add minutes to
      // structured analysis calls. Thinking is useful for open-ended chat, not JSON extraction.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const noThink = { think: false } as any
      const response = await ollama.chat({ model, messages, options: { temperature, ...noThink, ...(jsonMode ? { format: 'json' } : {}) } })
      // Small models sometimes return empty content when format:json is forced.
      // Retry without the format constraint — the prompt's own JSON instruction handles structure.
      if (jsonMode && !response.message.content?.trim()) {
        const retry = await ollama.chat({ model, messages, options: { temperature, ...noThink } })
        return retry.message.content
      }
      return response.message.content
    }
  }
}
