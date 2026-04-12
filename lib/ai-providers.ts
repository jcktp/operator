import { getSecret } from './settings'
import { getNoteSaved, resetNoteSaved } from './ai-tools'
import { chatAnthropicStream, chatAnthropicSimple } from './ai/anthropic'
import { chatOpenAIStream, chatOpenAISimple } from './ai/openai'
import { chatGoogleStream, chatGoogleSimple } from './ai/google'
import { chatOllamaStream, chatOllamaSimple } from './ai/ollama'
export type { Message, ChatResult } from './ai/types'
import type { Message, ChatResult } from './ai/types'

// ── Provider types ──────────────────────────────────────────────────────────

export type AIProvider = 'ollama' | 'anthropic' | 'openai' | 'google' | 'groq' | 'xai' | 'perplexity' | 'mistral'

export function getProvider(): AIProvider {
  return (process.env.AI_PROVIDER as AIProvider) ?? 'ollama'
}

export function maxContentLength(): number {
  if (getProvider() !== 'ollama') return 100_000
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { maxCharsForModel } = require('./model-capabilities') as typeof import('./model-capabilities')
  return maxCharsForModel(process.env.OLLAMA_MODEL ?? 'phi4-mini')
}

// ── chatWithToolsStream ─────────────────────────────────────────────────────

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

export async function chat(messages: Message[], temperature = 0.1, jsonMode = false): Promise<string> {
  const provider = getProvider()
  if (process.env.AIR_GAP_MODE === 'true' && provider !== 'ollama') {
    throw new Error('Air-gap mode is enabled — cloud AI providers are blocked. Switch to Ollama in Settings.')
  }
  switch (provider) {
    case 'anthropic':
      return chatAnthropicSimple(messages, temperature)
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
    case 'google':
      return chatGoogleSimple(messages, temperature, jsonMode)
    default:
      return chatOllamaSimple(messages, temperature, jsonMode)
  }
}
