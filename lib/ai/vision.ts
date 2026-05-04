// ── Image description (vision) + Audio transcription ─────────────────────────
import { getProvider } from '../ai-providers'
import { getSecret } from '../settings'
import { routeVisionModel, routeAudioModel } from '../models/capabilities'

const VISION_PROMPT = 'Describe only what you can clearly see in this image. Include visible text (quote it exactly, do not paraphrase or invent), people (without identifying them), objects, and context. If you cannot read text clearly, say so — do not guess or make up content.'

const OCR_PROMPT = 'Read and transcribe the text visible in this image exactly as it appears. Only include text you can clearly see — do not guess, infer, or fill in words you cannot read. Preserve line breaks and structure. Output only the transcribed text with no commentary.'

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
      // OCR path: use system tesseract binary — accurate, no downloads, no hallucination
      if (extractText) {
        const { execFile } = await import('child_process')
        const { promisify } = await import('util')
        const { writeFileSync, readFileSync, unlinkSync } = await import('fs')
        const { tmpdir } = await import('os')
        const { join } = await import('path')
        const exec = promisify(execFile)

        const ext = mimeType === 'image/png' ? 'png' : 'jpg'
        const tmpIn = join(tmpdir(), `ocr-in-${Date.now()}.${ext}`)
        const tmpOut = join(tmpdir(), `ocr-out-${Date.now()}`)
        writeFileSync(tmpIn, buffer)
        try {
          await exec('tesseract', [tmpIn, tmpOut, '-l', 'eng'], { timeout: 30_000 })
          const text = readFileSync(`${tmpOut}.txt`, 'utf8')
          return text.trim() || '[No text found in image]'
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.error('[ai-vision] tesseract failed:', msg)
          // Fall through to vision model with OCR prompt
        } finally {
          try { unlinkSync(tmpIn) } catch { /* ignore */ }
          try { unlinkSync(`${tmpOut}.txt`) } catch { /* ignore */ }
        }
      }

      // Vision description path: use routed vision model via Ollama REST API
      const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
      const model = routeVisionModel()
      // Race against a 3-minute timeout so a hung model-load never blocks the worker.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Vision timed out after 180s')), 180_000)
      )
      const fetchCall = fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt, images: [b64] }],
          stream: true,
        }),
      }).then(async r => {
        if (!r.ok) throw new Error(`Ollama HTTP ${r.status}: ${await r.text()}`)
        const text = await r.text()
        let full = ''
        for (const line of text.split('\n')) {
          const t = line.trim()
          if (!t) continue
          try {
            const obj = JSON.parse(t) as { message?: { content?: string }; error?: string }
            if (obj.error) throw new Error(obj.error)
            if (obj.message?.content) full += obj.message.content
          } catch { /* skip malformed lines */ }
        }
        return full
      })
      const description = (await Promise.race([fetchCall, timeout])).trim()
      return description || '[Image stored — vision model returned empty response]'
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
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[ai-vision] describeImage failed:', msg)
    return `[Image analysis failed: ${msg}]`
  }

  return '[Image stored — vision analysis not available for this provider]'
}

// ── Audio transcription ───────────────────────────────────────────────────────

const TRANSCRIPTION_PROMPT =
  'Transcribe this audio exactly as spoken. Preserve speaker labels if multiple speakers are present. ' +
  'Output only the transcript — no commentary, no timestamps unless there are significant pauses. ' +
  'If the audio is inaudible or empty, say so briefly.'

export async function transcribeAudio(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const provider = getProvider()

  try {
    if (provider === 'openai') {
      // OpenAI Whisper — multipart/form-data upload
      const key = getSecret('OPENAI_API_KEY')
      if (!key) throw new Error('OPENAI_API_KEY not set')
      const ext = fileName.split('.').pop() ?? 'mp3'
      const formData = new FormData()
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
      formData.append('file', new Blob([ab], { type: mimeType }), `audio.${ext}`)
      formData.append('model', 'whisper-1')
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}` },
        body: formData,
      })
      const data = await res.json() as { text?: string; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message)
      return data.text?.trim() || '[Audio transcription returned empty]'
    }

    if (provider === 'google') {
      // Gemini supports audio as inline_data in multimodal requests
      const key = getSecret('GOOGLE_API_KEY')
      if (!key) throw new Error('GOOGLE_API_KEY not set')
      const model = process.env.GOOGLE_MODEL ?? 'gemini-2.5-flash'
      const b64 = buffer.toString('base64')
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [
            { inline_data: { mime_type: mimeType, data: b64 } },
            { text: TRANSCRIPTION_PROMPT },
          ] }] }),
        }
      )
      const data = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message)
      return data.candidates?.[0]?.content.parts[0]?.text?.trim() ?? '[Audio stored — transcription empty]'
    }

    if (provider === 'ollama') {
      const audioModel = routeAudioModel()
      if (!audioModel) {
        return '[Audio transcription requires a model that supports audio (e.g. gemma4:e2b). Set OLLAMA_AUDIO_MODEL or switch to a model with audio support in Settings.]'
      }
      const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Audio transcription timed out after 300s')), 300_000)
      )

      const fetchCall = fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: audioModel,
          messages: [{ role: 'user', content: TRANSCRIPTION_PROMPT, audio: [buffer.toString('base64')] }],
          stream: true,
        }),
      }).then(async r => {
        if (!r.ok) throw new Error(`Ollama HTTP ${r.status}: ${await r.text()}`)
        let full = ''
        for (const line of (await r.text()).split('\n')) {
          const t = line.trim()
          if (!t) continue
          try {
            const obj = JSON.parse(t) as { message?: { content?: string }; error?: string }
            if (obj.error) throw new Error(obj.error)
            if (obj.message?.content) full += obj.message.content
          } catch { /* skip malformed lines */ }
        }
        return full
      })

      const transcript = (await Promise.race([fetchCall, timeout])).trim()
      return transcript || '[Audio stored — transcription model returned empty response]'
    }

    // Anthropic does not have a native audio transcription API
    if (provider === 'anthropic') {
      return '[Audio transcription is not available with the Anthropic provider. Switch to Ollama (gemma4:e2b), OpenAI, or Google to transcribe audio files.]'
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[ai-vision] transcribeAudio failed:', msg)
    return `[Audio transcription failed: ${msg}]`
  }

  return '[Audio stored — transcription not available for this provider]'
}
