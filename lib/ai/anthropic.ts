// ── Anthropic streaming provider ─────────────────────────────────────────────

import { fetchWithRetry, sseLines } from './stream-utils'
import { availableTools, executeTool } from './tools'
import { getSecret } from '../settings'
import type { Message } from './types'

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

export async function chatAnthropicStream(
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

export async function chatAnthropicSimple(
  messages: Message[],
  temperature: number,
): Promise<string> {
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
