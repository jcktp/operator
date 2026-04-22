import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { chat } from '@/lib/ai-providers'

interface IdentifyRequest {
  segments: Array<{ speaker: string; start: number; end: number; text?: string }>
  speakerLabels: string[]  // e.g. ["Speaker 1", "Speaker 2"]
}

export async function POST(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const body = await req.json() as IdentifyRequest
  const { segments, speakerLabels } = body

  if (!segments?.length || !speakerLabels?.length) {
    return NextResponse.json({ error: 'segments and speakerLabels are required' }, { status: 400 })
  }

  // Build a condensed transcript for the LLM
  const transcript = segments
    .filter(s => s.text)
    .map(s => `${s.speaker}: ${s.text}`)
    .join('\n')

  if (!transcript.trim()) {
    return NextResponse.json({ names: {} })
  }

  const prompt = `You are analysing a transcript of a conversation. The speakers are labelled ${speakerLabels.join(', ')}.

Based on the conversation below, identify the real names of the speakers if possible. Look for:
- Self-introductions ("I'm John", "My name is Sarah", "This is David speaking")
- Others addressing someone by name ("Thanks John", "Sarah, what do you think?")
- Sign-offs or greetings with names

Respond ONLY with a JSON object mapping speaker labels to identified names. Only include speakers whose names you are confident about. If you cannot identify a speaker's name, omit them from the object.

Example response: {"Speaker 1": "John Smith", "Speaker 3": "Sarah"}

Transcript:
${transcript.slice(0, 8000)}` // Cap to avoid overloading context

  try {
    const response = await chat(
      [{ role: 'user', content: prompt }],
      0.1,
      true,
    )

    // Parse the JSON response
    const cleaned = response.trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ names: {} })
    }

    const names = JSON.parse(jsonMatch[0]) as Record<string, string>

    // Validate: only return names that correspond to actual speaker labels
    const validated: Record<string, string> = {}
    for (const [label, name] of Object.entries(names)) {
      if (speakerLabels.includes(label) && typeof name === 'string' && name.trim()) {
        validated[label] = name.trim()
      }
    }

    return NextResponse.json({ names: validated })
  } catch {
    // If LLM fails, just return empty — speaker names aren't critical
    return NextResponse.json({ names: {} })
  }
}
