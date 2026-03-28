import { Ollama } from 'ollama'
import { availableTools, executeTool, getNoteSaved, resetNoteSaved } from './ai-tools'

// ── Provider types ──────────────────────────────────────────────────────────

export type AIProvider = 'ollama' | 'anthropic' | 'openai' | 'google' | 'groq' | 'xai' | 'perplexity' | 'mistral'

export function getProvider(): AIProvider {
  return (process.env.AI_PROVIDER as AIProvider) ?? 'ollama'
}

export function maxContentLength(): number {
  const p = getProvider()
  return p === 'ollama' ? 6000 : 20000
}

// ── Message types ───────────────────────────────────────────────────────────

export interface Message { role: 'user' | 'assistant'; content: string }

export interface ChatResult { content: string; noteSaved?: { title: string; folder: string } }

// ── Provider chat with tool calling ────────────────────────────────────────

export async function chatWithTools(messages: Message[], systemPrompt: string, temperature = 0.3, enableNoteTool = false): Promise<ChatResult> {
  resetNoteSaved()
  const provider = getProvider()
  let content: string
  switch (provider) {
    case 'anthropic':  content = await chatAnthropicTools(messages, systemPrompt, temperature, enableNoteTool); break
    case 'openai':     content = await chatOpenAITools(messages, systemPrompt, temperature, 'https://api.openai.com/v1/chat/completions', process.env.OPENAI_API_KEY!, process.env.OPENAI_MODEL ?? 'gpt-4o-mini', false, enableNoteTool); break
    case 'groq':       content = await chatOpenAITools(messages, systemPrompt, temperature, 'https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY!, process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant', false, enableNoteTool); break
    case 'google':     content = await chatGoogleTools(messages, systemPrompt, temperature, enableNoteTool); break
    case 'xai':        content = await chatOpenAITools(messages, systemPrompt, temperature, 'https://api.x.ai/v1/chat/completions', process.env.XAI_API_KEY!, process.env.XAI_MODEL ?? 'grok-3-mini', false, enableNoteTool); break
    case 'perplexity': content = await chatOpenAITools(messages, systemPrompt, temperature, 'https://api.perplexity.ai/chat/completions', process.env.PERPLEXITY_API_KEY!, process.env.PERPLEXITY_MODEL ?? 'llama-3.1-sonar-small-128k-online', true, enableNoteTool); break
    case 'mistral':    content = await chatOpenAITools(messages, systemPrompt, temperature, 'https://api.mistral.ai/v1/chat/completions', process.env.MISTRAL_API_KEY!, process.env.MISTRAL_MODEL ?? 'mistral-small-latest', false, enableNoteTool); break
    default:           content = await chatOllamaTools(messages, systemPrompt, temperature, enableNoteTool); break
  }
  return { content, noteSaved: getNoteSaved() ?? undefined }
}

// ── Anthropic tool calling ──────────────────────────────────────────────────

async function chatAnthropicTools(messages: Message[], systemPrompt: string, temperature: number, enableNoteTool = false): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
  const tools = availableTools(enableNoteTool)

  const anthropicTools = tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }))

  type AntMessage = { role: string; content: string | Array<{ type: string; tool_use_id?: string; content?: string; id?: string; name?: string; input?: Record<string, string> }> }
  const msgs: AntMessage[] = messages.map(m => ({ role: m.role, content: m.content }))

  for (let i = 0; i < 5; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, max_tokens: 2048, temperature, system: systemPrompt, messages: msgs, tools: anthropicTools }),
    })
    const data = await res.json() as {
      stop_reason?: string
      content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, string> }>
      error?: { message: string }
    }
    if (!res.ok) throw new Error(data.error?.message ?? 'Anthropic error')

    if (data.stop_reason === 'tool_use') {
      const toolUseBlocks = data.content!.filter(b => b.type === 'tool_use')
      msgs.push({ role: 'assistant', content: data.content! as AntMessage['content'] })
      const toolResults = await Promise.all(
        toolUseBlocks.map(async b => ({
          type: 'tool_result' as const,
          tool_use_id: b.id!,
          content: await executeTool(b.name!, b.input ?? {}),
        }))
      )
      msgs.push({ role: 'user', content: toolResults })
    } else {
      const textBlock = data.content?.find(b => b.type === 'text')
      return textBlock?.text ?? ''
    }
  }
  return 'Could not complete tool-calling loop.'
}

// ── OpenAI-compatible tool calling (OpenAI, Groq, xAI, Perplexity, Mistral) ─

async function chatOpenAITools(
  messages: Message[],
  systemPrompt: string,
  temperature: number,
  endpoint: string,
  apiKey: string,
  model: string,
  skipTools = false,
  enableNoteTool = false
): Promise<string> {
  if (!apiKey) throw new Error(`API key not set for ${endpoint}`)
  const tools = skipTools ? [] : availableTools(enableNoteTool).map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))

  type OAIMessage = { role: string; content?: string | null; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>; tool_call_id?: string; name?: string }
  const msgs: OAIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ]

  for (let i = 0; i < 5; i++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(tools.length > 0
        ? { model, messages: msgs, tools, tool_choice: 'auto', temperature }
        : { model, messages: msgs, temperature }),
    })
    const data = await res.json() as {
      choices?: Array<{
        finish_reason: string
        message: OAIMessage & { tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> }
      }>
      error?: { message: string }
    }
    if (!res.ok) throw new Error(data.error?.message ?? 'API error')
    const choice = data.choices?.[0]
    if (!choice) throw new Error('No response from API')

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      msgs.push(choice.message)
      const results = await Promise.all(
        choice.message.tool_calls.map(async tc => {
          const args = JSON.parse(tc.function.arguments) as Record<string, string>
          const result = await executeTool(tc.function.name, args)
          return { role: 'tool', tool_call_id: tc.id, content: result } as OAIMessage
        })
      )
      msgs.push(...results)
    } else {
      return choice.message.content ?? ''
    }
  }
  return 'Could not complete tool-calling loop.'
}

// ── Google (Gemini) tool calling ────────────────────────────────────────────

async function chatGoogleTools(messages: Message[], systemPrompt: string, temperature: number, enableNoteTool = false): Promise<string> {
  const key = process.env.GOOGLE_API_KEY
  if (!key) throw new Error('GOOGLE_API_KEY not set')
  const model = process.env.GOOGLE_MODEL ?? 'gemini-2.5-flash'
  const tools = availableTools(enableNoteTool)

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

  type GContent = { role: string; parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, string> }; functionResponse?: { name: string; response: { content: string } } }> }
  const contents: GContent[] = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood. How can I help?' }] },
    ...messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
  ]

  for (let i = 0; i < 5; i++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, tools: [{ function_declarations: functionDeclarations }], generationConfig: { temperature } }),
      }
    )
    const data = await res.json() as {
      candidates?: Array<{ content: GContent; finishReason?: string }>
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
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: funcCall.functionCall.name, response: { content: result } } }],
      })
    } else {
      return parts.map(p => p.text ?? '').join('')
    }
  }
  return 'Could not complete tool-calling loop.'
}

// ── Ollama tool calling ─────────────────────────────────────────────────────

async function chatOllamaTools(messages: Message[], systemPrompt: string, temperature: number, enableNoteTool = false): Promise<string> {
  const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
  const model = process.env.OLLAMA_MODEL ?? 'llama3.2:3b'
  const ollama = new Ollama({ host })
  const tools = availableTools(enableNoteTool)

  const ollamaTools = tools.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))

  const msgs = [
    { role: 'system' as const, content: systemPrompt },
    ...messages,
  ]

  try {
    for (let i = 0; i < 5; i++) {
      const response = await ollama.chat({
        model,
        messages: msgs,
        tools: ollamaTools,
        options: { temperature },
      })
      const msg = response.message

      if (msg.tool_calls?.length) {
        msgs.push({ role: 'assistant', content: msg.content ?? '' })
        for (const tc of msg.tool_calls) {
          const result = await executeTool(tc.function.name, tc.function.arguments as Record<string, string>)
          msgs.push({ role: 'tool' as never, content: result })
        }
      } else {
        return msg.content
      }
    }
    return 'Could not complete tool-calling loop.'
  } catch {
    const fallback = await ollama.chat({ model, messages: msgs, options: { temperature } })
    return fallback.message.content
  }
}

// ── Simple chat (no tools) ──────────────────────────────────────────────────

export async function chat(messages: Message[], temperature = 0.1, jsonMode = false): Promise<string> {
  const provider = getProvider()
  if (process.env.AIR_GAP_MODE === 'true' && provider !== 'ollama') {
    throw new Error('Air-gap mode is enabled — cloud AI providers are blocked. Switch to Ollama in Settings.')
  }
  switch (provider) {
    case 'anthropic': {
      const key = process.env.ANTHROPIC_API_KEY
      if (!key) throw new Error('ANTHROPIC_API_KEY not set')
      const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 2048, temperature, messages }),
      })
      const data = await res.json() as { content?: Array<{ text: string }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message ?? 'Anthropic error')
      return data.content?.[0]?.text ?? ''
    }
    case 'openai': {
      const key = process.env.OPENAI_API_KEY
      if (!key) throw new Error('OPENAI_API_KEY not set')
      const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature, ...(jsonMode ? { response_format: { type: 'json_object' } } : {}) }),
      })
      const data = await res.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message ?? 'OpenAI error')
      return data.choices?.[0]?.message.content ?? ''
    }
    case 'groq': {
      const key = process.env.GROQ_API_KEY
      if (!key) throw new Error('GROQ_API_KEY not set')
      const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature, ...(jsonMode ? { response_format: { type: 'json_object' } } : {}) }),
      })
      const data = await res.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message ?? 'Groq error')
      return data.choices?.[0]?.message.content ?? ''
    }
    case 'xai': {
      const key = process.env.XAI_API_KEY
      if (!key) throw new Error('XAI_API_KEY not set')
      const model = process.env.XAI_MODEL ?? 'grok-3-mini'
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: '' }, ...messages], temperature, ...(jsonMode ? { response_format: { type: 'json_object' } } : {}) }),
      })
      const data = await res.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message ?? 'xAI error')
      return data.choices?.[0]?.message.content ?? ''
    }
    case 'perplexity': {
      const key = process.env.PERPLEXITY_API_KEY
      if (!key) throw new Error('PERPLEXITY_API_KEY not set')
      const model = process.env.PERPLEXITY_MODEL ?? 'llama-3.1-sonar-small-128k-online'
      const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature }),
      })
      const data = await res.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message ?? 'Perplexity error')
      return data.choices?.[0]?.message.content ?? ''
    }
    case 'google': {
      const key = process.env.GOOGLE_API_KEY
      if (!key) throw new Error('GOOGLE_API_KEY not set')
      const model = process.env.GOOGLE_MODEL ?? 'gemini-2.5-flash'
      const prompt = messages.map(m => m.content).join('\n\n')
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature, ...(jsonMode ? { responseMimeType: 'application/json' } : {}) } }),
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
