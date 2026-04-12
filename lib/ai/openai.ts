// ── OpenAI-compatible streaming provider ─────────────────────────────────────
// Used by: OpenAI, Groq, xAI, Perplexity, Mistral

import { fetchWithRetry, sseLines } from './stream-utils'
import { availableTools, executeTool } from '../ai-tools'
import type { Message } from '../ai-providers'

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

export async function chatOpenAIStream(
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

export async function chatOpenAISimple(
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
