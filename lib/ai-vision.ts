// ── Image description (vision) ───────────────────────────────────────────────
import { getProvider } from './ai-providers'
import { getSecret } from './settings'

const VISION_PROMPT = 'Describe this image in detail. Include any visible text, numbers, people (without identifying them), objects, and context that would be useful for research or reporting purposes.'

export async function describeImage(buffer: Buffer, mimeType: string): Promise<string> {
  const provider = getProvider()
  const b64 = buffer.toString('base64')

  try {
    if (provider === 'anthropic') {
      const key = getSecret('ANTHROPIC_API_KEY')
      if (!key) throw new Error('No key')
      const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model, max_tokens: 1024,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } },
            { type: 'text', text: VISION_PROMPT },
          ] }],
        }),
      })
      const data = await res.json() as { content?: Array<{ text: string }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message)
      return data.content?.[0]?.text ?? '[Image stored]'
    }

    if (provider === 'openai') {
      const key = getSecret('OPENAI_API_KEY')
      if (!key) throw new Error('No key')
      const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } },
            { type: 'text', text: VISION_PROMPT },
          ] }],
        }),
      })
      const data = await res.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message)
      return data.choices?.[0]?.message.content ?? '[Image stored]'
    }

    if (provider === 'google') {
      const key = getSecret('GOOGLE_API_KEY')
      if (!key) throw new Error('No key')
      const model = process.env.GOOGLE_MODEL ?? 'gemini-2.5-flash'
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [
            { inline_data: { mime_type: mimeType, data: b64 } },
            { text: VISION_PROMPT },
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

  return '[Image stored — switch to a cloud AI provider (Anthropic, OpenAI, or Google) to enable automatic image descriptions]'
}
