import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { model } = await req.json()
  if (!model) return new Response('model required', { status: 400 })

  const ollamaHost = process.env.OLLAMA_HOST ?? 'http://localhost:11434'

  // Stream Ollama's pull progress as SSE
  const ollamaRes = await fetch(`${ollamaHost}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: model, stream: true }),
  }).catch(() => null)

  if (!ollamaRes) {
    return new Response('data: {"error":"Could not connect to Ollama. Make sure it is running."}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  // Ollama returns 412 when the installed version is too old for the requested model.
  if (ollamaRes.status === 412) {
    const msg = 'Your Ollama version is too old for this model. Download the latest version at ollama.com/download, then try again.'
    return new Response(`data: ${JSON.stringify({ error: msg, updateRequired: true })}\n\n`, {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  if (!ollamaRes.body) {
    return new Response('data: {"error":"Could not connect to Ollama"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const reader = ollamaRes.body!.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n').filter(l => l.trim())

          for (const line of lines) {
            try {
              const data = JSON.parse(line)
              if (data.error) {
                // Detect version-too-old errors from the streaming body (some Ollama versions send 412 here)
                const isVersionError = /412|newer version|update ollama/i.test(String(data.error))
                const errorMsg = isVersionError
                  ? 'Your Ollama version is too old for this model. Download the latest version at ollama.com/download, then try again.'
                  : data.error
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ error: errorMsg, updateRequired: isVersionError })}\n\n`)
                )
                reader.cancel()
                controller.close()
                return
              }
              let progress = 0
              if (data.total && data.completed) {
                progress = Math.round((data.completed / data.total) * 100)
              } else if (data.status === 'success') {
                progress = 100
              }
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ status: data.status, progress })}\n\n`)
              )
            } catch {}
          }
        }
      } finally {
        reader.releaseLock()
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
