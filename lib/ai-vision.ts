// ── Image description (vision) ───────────────────────────────────────────────
import { getProvider } from './ai-providers'
import { getSecret } from './settings'
import { Ollama } from 'ollama'

const VISION_PROMPT = 'Describe this image in detail. Include any visible text, numbers, people (without identifying them), objects, and context that would be useful for research or reporting purposes.'

const OCR_PROMPT = 'Extract all readable text from this image exactly as it appears. Preserve formatting, line breaks, and structure as closely as possible. Output only the extracted text with no commentary or explanation.'

export async function describeImage(buffer: Buffer, mimeType: string, extractText = false): Promise<string> {
  const prompt = extractText ? OCR_PROMPT : VISION_PROMPT
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
            { type: 'text', text: prompt },
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
            { type: 'text', text: prompt },
          ] }],
        }),
      })
      const data = await res.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message)
      return data.choices?.[0]?.message.content ?? '[Image stored]'
    }

    if (provider === 'ollama') {
      // Use a vision-capable Ollama model (default: llava).
      // Set OLLAMA_VISION_MODEL in your environment to use a different model (e.g. moondream, bakllava).
      const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
      // moondream is ~1.7 GB — much lighter than llava (~4.7 GB).
      // Ollama swaps models on demand so phi4-mini and moondream don't run simultaneously.
      const model = process.env.OLLAMA_VISION_MODEL ?? 'moondream'
      const ollama = new Ollama({ host })
      const res = await ollama.chat({
        model,
        messages: [{ role: 'user', content: prompt, images: [b64] }],
      })
      return res.message.content || '[Image stored]'
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
            { text: prompt },
          ] }] }),
        }
      )
      const data = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message)
      return data.candidates?.[0]?.content.parts[0]?.text ?? '[Image stored]'
    }
  } catch (e) {
    console.error('[ai-vision] describeImage failed:', e)
  }

  return '[Image stored — vision analysis failed or no vision-capable model available. For Ollama, run: ollama pull moondream]'
}
