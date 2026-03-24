import { Ollama } from 'ollama'
import { parseJsonSafe } from './utils'
import type { Metric, Insight, Question } from './utils'
import { PERSONAS, type PersonaId } from './personas'
import { getModeConfig } from './mode'

// ── Provider types ──────────────────────────────────────────────────────────

export type AIProvider = 'ollama' | 'anthropic' | 'openai' | 'google' | 'groq' | 'xai' | 'perplexity'

function getProvider(): AIProvider {
  return (process.env.AI_PROVIDER as AIProvider) ?? 'ollama'
}

function maxContentLength(): number {
  const p = getProvider()
  return p === 'ollama' ? 6000 : 20000
}

// ── Message types ───────────────────────────────────────────────────────────

interface Message { role: 'user' | 'assistant'; content: string }

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOL_WEATHER = {
  name: 'get_weather',
  description: 'Get the current weather for any location. Always use this when asked about weather.',
  parameters: {
    type: 'object' as const,
    properties: {
      location: { type: 'string', description: 'City or location name, e.g. "London" or "Tokyo, Japan"' },
    },
    required: ['location'],
  },
}

const TOOL_SEARCH = {
  name: 'search_web',
  description: 'Search the web for current information, news, prices, or any real-time data. Use for questions that require up-to-date knowledge.',
  parameters: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'The search query' },
    },
    required: ['query'],
  },
}

const TOOL_FETCH = {
  name: 'fetch_url',
  description: 'Fetch and read the content of a web page or URL.',
  parameters: {
    type: 'object' as const,
    properties: {
      url: { type: 'string', description: 'The URL to fetch' },
    },
    required: ['url'],
  },
}

type ToolDef = { name: string; description: string; parameters: { type: 'object'; properties: Record<string, { type: string; description: string }>; required: string[] } }

function availableTools(): ToolDef[] {
  if (process.env.OLLAMA_WEB_ACCESS !== 'true') return []
  const tools: ToolDef[] = [TOOL_WEATHER, TOOL_FETCH]
  if (process.env.BRAVE_SEARCH_KEY) tools.push(TOOL_SEARCH)
  return tools
}

// ── Tool execution ──────────────────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, string>): Promise<string> {
  try {
    if (name === 'get_weather') return await toolWeather(args.location)
    if (name === 'search_web')  return await toolSearch(args.query)
    if (name === 'fetch_url')   return await toolFetchUrl(args.url)
    return `Unknown tool: ${name}`
  } catch (e) {
    return `Tool error: ${String(e)}`
  }
}

async function toolWeather(location: string): Promise<string> {
  // 1. Geocode
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
    { signal: AbortSignal.timeout(8000) }
  )
  const geoData = await geoRes.json() as { results?: Array<{ latitude: number; longitude: number; name: string; country: string; admin1?: string }> }
  if (!geoData.results?.length) return `Could not find location: "${location}"`
  const { latitude, longitude, name, country, admin1 } = geoData.results[0]

  // 2. Current weather
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,precipitation,is_day` +
    `&timezone=auto&forecast_days=1`,
    { signal: AbortSignal.timeout(8000) }
  )
  const wd = await weatherRes.json() as { current: Record<string, number>; current_units: Record<string, string> }
  const c = wd.current
  const u = wd.current_units

  const codes: Record<number, string> = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Freezing fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Rain showers', 81: 'Showers', 82: 'Violent showers',
    85: 'Snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail',
  }
  const desc = codes[c.weather_code] ?? `Condition code ${c.weather_code}`
  const place = [name, admin1, country].filter(Boolean).join(', ')

  return [
    `**Current weather in ${place}:**`,
    `- Conditions: ${desc}`,
    `- Temperature: ${c.temperature_2m}${u.temperature_2m} (feels like ${c.apparent_temperature}${u.apparent_temperature})`,
    `- Wind: ${c.wind_speed_10m} ${u.wind_speed_10m}`,
    `- Humidity: ${c.relative_humidity_2m}${u.relative_humidity_2m}`,
    c.precipitation > 0 ? `- Precipitation: ${c.precipitation}${u.precipitation}` : null,
  ].filter(Boolean).join('\n')
}

async function toolSearch(query: string): Promise<string> {
  const key = process.env.BRAVE_SEARCH_KEY
  if (!key) return 'Web search is not configured. Add a Brave Search API key in Settings.'

  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&safesearch=off`,
    {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': key },
      signal: AbortSignal.timeout(8000),
    }
  )
  const data = await res.json() as { web?: { results?: Array<{ title: string; url: string; description: string }> } }
  const results = data.web?.results ?? []
  if (!results.length) return `No search results found for: "${query}"`

  return results.map((r, i) =>
    `${i + 1}. **${r.title}**\n   ${r.description}\n   ${r.url}`
  ).join('\n\n')
}

async function toolFetchUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Operator/1.0)' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return `HTTP ${res.status} — could not fetch ${url}`
  const text = await res.text()
  const clean = text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)
  return `Content from ${url}:\n\n${clean}`
}

// ── Provider chat with tool calling ────────────────────────────────────────

async function chatWithTools(messages: Message[], systemPrompt: string, temperature = 0.3): Promise<string> {
  const provider = getProvider()
  switch (provider) {
    case 'anthropic':  return chatAnthropicTools(messages, systemPrompt, temperature)
    case 'openai':     return chatOpenAITools(messages, systemPrompt, temperature, 'https://api.openai.com/v1/chat/completions', process.env.OPENAI_API_KEY!, process.env.OPENAI_MODEL ?? 'gpt-4o-mini')
    case 'groq':       return chatOpenAITools(messages, systemPrompt, temperature, 'https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY!, process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant')
    case 'google':     return chatGoogleTools(messages, systemPrompt, temperature)
    case 'xai':        return chatOpenAITools(messages, systemPrompt, temperature, 'https://api.x.ai/v1/chat/completions', process.env.XAI_API_KEY!, process.env.XAI_MODEL ?? 'grok-3-mini')
    // Perplexity sonar models search the web natively — don't pass tool_choice
    case 'perplexity': return chatOpenAITools(messages, systemPrompt, temperature, 'https://api.perplexity.ai/chat/completions', process.env.PERPLEXITY_API_KEY!, process.env.PERPLEXITY_MODEL ?? 'llama-3.1-sonar-small-128k-online', true)
    default:           return chatOllamaTools(messages, systemPrompt, temperature)
  }
}

// ── Anthropic tool calling ──────────────────────────────────────────────────

async function chatAnthropicTools(messages: Message[], systemPrompt: string, temperature: number): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
  const tools = availableTools()

  const anthropicTools = tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }))

  // Mutable message list for the tool loop
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
      // Add the assistant's response (including tool_use blocks) to messages
      msgs.push({ role: 'assistant', content: data.content! as AntMessage['content'] })
      // Execute tools and add results
      const toolResults = await Promise.all(
        toolUseBlocks.map(async b => ({
          type: 'tool_result' as const,
          tool_use_id: b.id!,
          content: await executeTool(b.name!, b.input ?? {}),
        }))
      )
      msgs.push({ role: 'user', content: toolResults })
    } else {
      // end_turn — return text
      const textBlock = data.content?.find(b => b.type === 'text')
      return textBlock?.text ?? ''
    }
  }
  return 'Could not complete tool-calling loop.'
}

// ── OpenAI-compatible tool calling (OpenAI + Groq) ──────────────────────────

async function chatOpenAITools(
  messages: Message[],
  systemPrompt: string,
  temperature: number,
  endpoint: string,
  apiKey: string,
  model: string,
  skipTools = false
): Promise<string> {
  if (!apiKey) throw new Error(`API key not set for ${endpoint}`)
  const tools = skipTools ? [] : availableTools().map(t => ({
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

async function chatGoogleTools(messages: Message[], systemPrompt: string, temperature: number): Promise<string> {
  const key = process.env.GOOGLE_API_KEY
  if (!key) throw new Error('GOOGLE_API_KEY not set')
  const model = process.env.GOOGLE_MODEL ?? 'gemini-1.5-flash'
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

async function chatOllamaTools(messages: Message[], systemPrompt: string, temperature: number): Promise<string> {
  const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
  const model = process.env.OLLAMA_MODEL ?? 'llama3.2:3b'
  const ollama = new Ollama({ host })
  const tools = availableTools()

  // Ollama tool format (same as OpenAI)
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
    // Model may not support tools — fall back to plain chat (keep system message)
    const fallback = await ollama.chat({ model, messages: msgs, options: { temperature } })
    return fallback.message.content
  }
}

// ── Simple chat (no tools) ──────────────────────────────────────────────────

async function chat(messages: Message[], temperature = 0.1, jsonMode = false): Promise<string> {
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
      const model = process.env.GOOGLE_MODEL ?? 'gemini-1.5-flash'
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

// ── JSON extraction ─────────────────────────────────────────────────────────

function extractJson(text: string): string {
  // Strip leading/trailing whitespace
  const t = text.trim()

  // Try fenced code blocks first (```json ... ``` or ``` ... ```)
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    const candidate = fenced[1].trim()
    try { JSON.parse(candidate); return candidate } catch {}
  }

  // Find outermost { }
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start !== -1 && end > start) {
    const candidate = t.slice(start, end + 1)
    try { JSON.parse(candidate); return candidate } catch {}
  }

  throw new Error(`No valid JSON in response (len=${t.length}, preview=${t.slice(0, 100)})`)
}

// ── Public interfaces ──────────────────────────────────────────────────────

export type { Metric, Insight, Question }

export interface ReportAnalysis {
  summary: string
  metrics: Metric[]
  insights: Insight[]
  questions: Question[]
}

export interface ComparisonChange {
  metric: string
  previous: string
  current: string
  direction: 'improved' | 'declined' | 'unchanged' | 'new' | 'removed'
  significance: 'high' | 'medium' | 'low'
  note?: string
}

export interface ReportComparison {
  headline: string
  changes: ComparisonChange[]
  newTopics: string[]
  removedTopics: string[]
}

// ── Analysis functions ──────────────────────────────────────────────────────

// ── Image description (vision) ──────────────────────────────────────────────

export async function describeImage(buffer: Buffer, mimeType: string): Promise<string> {
  const provider = getProvider()
  const b64 = buffer.toString('base64')

  try {
    if (provider === 'anthropic') {
      const key = process.env.ANTHROPIC_API_KEY
      if (!key) throw new Error('No key')
      const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model, max_tokens: 1024,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } },
            { type: 'text', text: 'Describe this image in detail. Include any visible text, numbers, people (without identifying them), objects, and context that would be useful for research or reporting purposes.' },
          ] }],
        }),
      })
      const data = await res.json() as { content?: Array<{ text: string }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message)
      return data.content?.[0]?.text ?? '[Image stored]'
    }

    if (provider === 'openai') {
      const key = process.env.OPENAI_API_KEY
      if (!key) throw new Error('No key')
      const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } },
            { type: 'text', text: 'Describe this image in detail. Include any visible text, numbers, people (without identifying them), objects, and context that would be useful for research or reporting purposes.' },
          ] }],
        }),
      })
      const data = await res.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message)
      return data.choices?.[0]?.message.content ?? '[Image stored]'
    }

    if (provider === 'google') {
      const key = process.env.GOOGLE_API_KEY
      if (!key) throw new Error('No key')
      const model = process.env.GOOGLE_MODEL ?? 'gemini-1.5-flash'
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [
            { inline_data: { mime_type: mimeType, data: b64 } },
            { text: 'Describe this image in detail. Include any visible text, numbers, people (without identifying them), objects, and context that would be useful for research or reporting purposes.' },
          ] }] }),
        }
      )
      const data = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message)
      return data.candidates?.[0]?.content.parts[0]?.text ?? '[Image stored]'
    }
  } catch (e) {
    console.warn('Image description failed:', e)
  }

  // Ollama and unsupported providers — store without description
  return '[Image stored — switch to a cloud AI provider (Anthropic, OpenAI, or Google) to enable automatic image descriptions]'
}

function isCloudProvider(): boolean {
  return getProvider() !== 'ollama'
}

export async function analyzeReport(
  content: string,
  reportTitle: string,
  area: string,
  directName?: string
): Promise<ReportAnalysis> {
  const modeConfig = getModeConfig(process.env.APP_MODE)
  const truncated = content.slice(0, maxContentLength())
  const from = directName ? `\nSubmitted by: ${directName}` : ''

  const cloudPrompt = `You are a senior analyst reviewing a ${modeConfig.documentLabel.toLowerCase()} for a ${modeConfig.label.toLowerCase()}.

Document: ${reportTitle}
Area: ${area}${from}

${modeConfig.analysisFraming}

STRICT RULES:
- Only surface numbers and facts that appear verbatim in the document. Never calculate, infer, or estimate figures.
- Do not invent metrics, trends, or observations not explicitly stated.
- If a value is not present, omit it rather than guessing.

Document content:
${truncated}

Return ONLY valid JSON with this exact structure:
{
  "summary": "2-3 sentence factual summary of what this report covers and its key findings",
  "metrics": [
    {"label": "metric name", "value": "exact value as written in document", "context": "comparison or target if stated", "trend": "up|down|flat|unknown", "status": "positive|negative|neutral|warning"}
  ],
  "insights": [
    {"type": "observation|anomaly|risk|opportunity", "text": "specific factual observation directly from the document", "area": "${area.toLowerCase()}"}
  ],
  "questions": [
    {"text": "specific follow-up question", "why": "why this matters to the ${modeConfig.label.toLowerCase()}", "priority": "high|medium|low"}
  ]
}

Limits: max 10 metrics, 5 insights, 4 questions. Use only data from the document.`

  const ollamaPrompt = `Analyze this ${modeConfig.documentLabel.toLowerCase()}. Extract only facts that appear in the text — never calculate or invent numbers.

Document: ${reportTitle} (${area})${from}

${truncated}

Reply with ONLY valid JSON:
{
  "summary": "2-3 sentence summary",
  "metrics": [{"label": "name", "value": "exact value from text", "context": "context if stated", "trend": "up|down|flat|unknown", "status": "positive|negative|neutral|warning"}],
  "insights": [{"type": "observation|anomaly|risk|opportunity", "text": "observation from document", "area": "${area.toLowerCase()}"}],
  "questions": [{"text": "follow-up question", "why": "why it matters", "priority": "high|medium|low"}]
}
Limits: max 10 metrics, 5 insights, 4 questions.`

  const prompt = isCloudProvider() ? cloudPrompt : ollamaPrompt
  const text = await chat([{ role: 'user', content: prompt }], 0.1, true)

  let parsed: ReportAnalysis
  try {
    const json = extractJson(text)
    parsed = JSON.parse(json) as ReportAnalysis
  } catch (e) {
    console.error('analyzeReport JSON parse failed:', e, 'raw response:', text.slice(0, 500))
    return { summary: '', metrics: [], insights: [], questions: [] }
  }

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
  }
}

export async function compareReports(
  previousSummary: string,
  previousMetrics: string,
  currentSummary: string,
  currentMetrics: string,
  area: string
): Promise<ReportComparison> {
  const prevMetrics = parseJsonSafe<Metric[]>(previousMetrics, [])
  const currMetrics = parseJsonSafe<Metric[]>(currentMetrics, [])

  const prevText = `Summary: ${previousSummary}\nMetrics: ${prevMetrics.map(m => `${m.label}: ${m.value}`).join(', ')}`
  const currText = `Summary: ${currentSummary}\nMetrics: ${currMetrics.map(m => `${m.label}: ${m.value}`).join(', ')}`

  const prompt = `Compare two ${area} reports for a CEO. Identify what changed, improved, or declined.

PREVIOUS REPORT:
${prevText}

CURRENT REPORT:
${currText}

Reply with ONLY valid JSON:
{
  "headline": "1 sentence summarising the most important change",
  "changes": [{"metric": "metric or topic name", "previous": "previous value/state", "current": "current value/state", "direction": "improved|declined|unchanged|new|removed", "significance": "high|medium|low", "note": "optional context"}],
  "newTopics": ["topics or metrics that appear in current but not previous"],
  "removedTopics": ["topics or metrics in previous but missing from current"]
}

Limits: max 8 changes, max 4 newTopics, max 4 removedTopics.`

  const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
  const json = extractJson(text)
  const parsed = JSON.parse(json) as ReportComparison
  return {
    headline: parsed.headline ?? '',
    changes: Array.isArray(parsed.changes) ? parsed.changes : [],
    newTopics: Array.isArray(parsed.newTopics) ? parsed.newTopics : [],
    removedTopics: Array.isArray(parsed.removedTopics) ? parsed.removedTopics : [],
  }
}

export async function checkResolvedFlags(
  previousFlags: Array<{ text: string; type: string }>,
  newContent: string,
  newInsights: Insight[]
): Promise<string[]> {
  if (previousFlags.length === 0) return []
  const flagsList = previousFlags.map((f, i) => `${i + 1}. [${f.type}] ${f.text}`).join('\n')
  const newInsightsList = newInsights.map(i => `[${i.type}] ${i.text}`).join('\n') || 'None'
  const prompt = `Previous report flags:
${flagsList}

New report content (excerpt):
${newContent.slice(0, 3000)}

New report flags:
${newInsightsList}

Which numbered previous flags appear resolved or no longer a concern based on the new report?
Reply with ONLY valid JSON: {"resolved": [1, 3]} — empty array if none.`

  try {
    const text = await chat([{ role: 'user', content: prompt }])
    const json = extractJson(text)
    const parsed = JSON.parse(json) as { resolved: number[] }
    if (!Array.isArray(parsed.resolved)) return []
    return parsed.resolved
      .filter(i => typeof i === 'number' && i >= 1 && i <= previousFlags.length)
      .map(i => previousFlags[i - 1].text)
  } catch {
    return []
  }
}

export async function dispatchChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: string,
  personaId: PersonaId = 'dispatch',
  userMemory = ''
): Promise<string> {
  const persona = PERSONAS[personaId]
  const hasSearch = !!process.env.BRAVE_SEARCH_KEY
  const systemPrompt = persona.buildSystemPrompt(context, userMemory, hasSearch)
  return chatWithTools(messages, systemPrompt, persona.temperature)
}

/**
 * Extracts 1–3 short factual statements worth remembering from a conversation.
 * Returns an empty array if nothing noteworthy was found.
 * Runs as a lightweight background call — failures are safe to ignore.
 */
export async function extractMemoryFacts(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  existingMemory: string
): Promise<string[]> {
  if (messages.length < 2) return []

  const recent = messages.slice(-6) // last 3 turns
  const prompt = `You are reading a short business conversation between a CEO and an AI assistant. Extract any NEW facts about this person's business, goals, or preferences that would be useful to remember in future conversations.

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
    const json = extractJson(text)
    const parsed = JSON.parse(json) as { facts?: unknown }
    if (!Array.isArray(parsed.facts)) return []
    return (parsed.facts as unknown[])
      .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      .slice(0, 2)
  } catch {
    return []
  }
}

export async function generateDashboardInsights(
  reports: Array<{ area: string; summary: string; metrics: string; insights: string }>
): Promise<{ crossInsights: Insight[]; topQuestions: Question[]; healthSignal: string }> {
  if (reports.length === 0) {
    return { crossInsights: [], topQuestions: [], healthSignal: 'No reports available.' }
  }

  const reportsText = reports
    .slice(0, 8)
    .map(r => {
      let metricsData: Metric[] = []
      let insightsData: Insight[] = []
      try { metricsData = JSON.parse(r.metrics || '[]') } catch {}
      try { insightsData = JSON.parse(r.insights || '[]') } catch {}
      return `${r.area}: ${r.summary}. Metrics: ${metricsData.slice(0, 4).map(m => `${m.label} ${m.value}`).join(', ')}. Flags: ${insightsData.slice(0, 3).map(i => i.text).join('; ')}`
    })
    .join('\n')

  const prompt = `You are advising a CEO based on recent reports from their direct reports.

Reports:
${reportsText}

Reply with ONLY valid JSON, no other text:
{
  "healthSignal": "1-2 sentence overall company health assessment",
  "crossInsights": [{"type": "observation|anomaly|risk|opportunity", "text": "cross-area pattern or key signal", "area": "areas involved"}],
  "topQuestions": [{"text": "most important question for the CEO to ask", "why": "why it matters", "priority": "high|medium|low"}]
}

Limits: max 4 crossInsights, 4 topQuestions. Only use what the reports contain.`

  const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
  const json = extractJson(text)
  const parsed = JSON.parse(json)
  return {
    healthSignal: parsed.healthSignal ?? '',
    crossInsights: Array.isArray(parsed.crossInsights) ? parsed.crossInsights : [],
    topQuestions: Array.isArray(parsed.topQuestions) ? parsed.topQuestions : [],
  }
}
