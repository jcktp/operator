// ── Google (Gemini) streaming provider ───────────────────────────────────────

import { fetchWithRetry } from './stream-utils'
import { availableTools, executeTool } from './tools'
import { getSecret } from '../settings'
import type { Message } from './types'

type GPart = { text?: string; functionCall?: { name: string; args: Record<string, string> }; functionResponse?: { name: string; response: { content: string } } }
type GContent = { role: string; parts: GPart[] }

export async function chatGoogleStream(
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

export async function chatGoogleSimple(
  messages: Message[],
  temperature: number,
  jsonMode = false,
): Promise<string> {
  const key = getSecret('GOOGLE_API_KEY')
  if (!key) throw new Error('GOOGLE_API_KEY not set')
  const model = process.env.GOOGLE_MODEL ?? 'gemini-2.5-flash'
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
