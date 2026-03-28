import { Ollama } from 'ollama'
import { availableTools, hasNoteSaveIntent, executeTool, getNoteSaved, resetNoteSaved } from './ai-tools'
import { getSecret } from './settings'

// ── Provider types ──────────────────────────────────────────────────────────

export type AIProvider = 'ollama' | 'anthropic' | 'openai' | 'google' | 'groq' | 'xai' | 'perplexity' | 'mistral'

export function getProvider(): AIProvider {
  return (process.env.AI_PROVIDER as AIProvider) ?? 'ollama'
}

export function maxContentLength(): number {
  // Cloud models (Claude, GPT-4o, Gemini) have 128k–1M token windows —
  // 100k chars is still well within that and covers ~75 pages of text.
  // Ollama small models have ~4k–8k token windows; chunking handles the rest.
  return getProvider() === 'ollama' ? 5000 : 100_000
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
        toolBlocks.map(async b => ({
          type: 'tool_result',
          tool_use_id: b.id,
          content: await executeTool(b.name, b.input),
        }))
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
      const result = await executeTool(funcCall.functionCall.name, funcCall.functionCall.args)
      contents.push({ role: 'user', parts: [{ functionResponse: { name: funcCall.functionCall.name, response: { content: result } } }] })
    } else {
      emit(parts.map(p => p.text ?? '').join(''))
      return
    }
  }
}

// ── Ollama streaming ────────────────────────────────────────────────────────

async function chatOllamaStream(
  messages: Message[],
  systemPrompt: string,
  temperature: number,
  emit: (chunk: string) => void,
): Promise<void> {
  const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
  const model = process.env.OLLAMA_MODEL ?? 'llama3.2:3b'
  const ollama = new Ollama({ host })
  const tools = availableTools(hasNoteSaveIntent(messages))
  const ollamaTools = tools.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))
  const msgs = [{ role: 'system' as const, content: systemPrompt }, ...messages]

  try {
    for (let i = 0; i < 5; i++) {
      // Stream the call; tool_calls only appear in the final done chunk.
      // When the model uses tools its content is empty, so emit() is a no-op.
      const stream = await ollama.chat({
        model, messages: msgs, tools: ollamaTools,
        stream: true, options: { temperature },
      })
      let accContent = ''
      let finalToolCalls: Array<{ function: { name: string; arguments: unknown } }> | undefined

      for await (const chunk of stream) {
        if (chunk.message.content) {
          accContent += chunk.message.content
          emit(chunk.message.content)
        }
        if (chunk.done) finalToolCalls = chunk.message.tool_calls
      }

      if (finalToolCalls?.length) {
        msgs.push({ role: 'assistant', content: accContent })
        for (const tc of finalToolCalls) {
          const result = await executeTool(tc.function.name, tc.function.arguments as Record<string, string>)
          msgs.push({ role: 'tool' as never, content: result })
        }
      } else {
        return
      }
    }
  } catch {
    // Fallback to non-streaming
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

      try {
        switch (provider) {
          case 'anthropic':
            await chatAnthropicStream(messages, systemPrompt, temperature, emit)
            break
          case 'openai':
            await chatOpenAIStream(messages, systemPrompt, temperature, 'https://api.openai.com/v1/chat/completions', getSecret('OPENAI_API_KEY') ?? '', process.env.OPENAI_MODEL ?? 'gpt-4o-mini', false, emit)
            break
          case 'groq':
            await chatOpenAIStream(messages, systemPrompt, temperature, 'https://api.groq.com/openai/v1/chat/completions', getSecret('GROQ_API_KEY') ?? '', process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant', false, emit)
            break
          case 'google':
            await chatGoogleStream(messages, systemPrompt, temperature, emit)
            break
          case 'xai':
            await chatOpenAIStream(messages, systemPrompt, temperature, 'https://api.x.ai/v1/chat/completions', getSecret('XAI_API_KEY') ?? '', process.env.XAI_MODEL ?? 'grok-3-mini', false, emit)
            break
          case 'perplexity':
            await chatOpenAIStream(messages, systemPrompt, temperature, 'https://api.perplexity.ai/chat/completions', getSecret('PERPLEXITY_API_KEY') ?? '', process.env.PERPLEXITY_MODEL ?? 'llama-3.1-sonar-small-128k-online', true, emit)
            break
          case 'mistral':
            await chatOpenAIStream(messages, systemPrompt, temperature, 'https://api.mistral.ai/v1/chat/completions', getSecret('MISTRAL_API_KEY') ?? '', process.env.MISTRAL_MODEL ?? 'mistral-small-latest', false, emit)
            break
          default:
            await chatOllamaStream(messages, systemPrompt, temperature, emit)
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
      const model = process.env.OLLAMA_MODEL ?? 'llama3.2:3b'
      const ollama = new Ollama({ host })
      const response = await ollama.chat({ model, messages, options: { temperature, ...(jsonMode ? { format: 'json' } : {}) } })
      return response.message.content
    }
  }
}
