import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { chat } from '@/lib/ai-providers'
import { loadAiSettings } from '@/lib/settings'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  try {
    const body = await req.json() as {
      agency: string
      subject: string
      description?: string
      requesterName?: string
      requesterAddress?: string
    }

    if (!body.agency?.trim() || !body.subject?.trim()) {
      return NextResponse.json({ error: 'agency and subject are required' }, { status: 400 })
    }

    await loadAiSettings()

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const requester = body.requesterName?.trim() || '[Your Name]'
    const address = body.requesterAddress?.trim() || '[Your Address]'

    const prompt = `You are a journalist drafting a formal Freedom of Information Act (FOIA) request letter. Write a complete, professional FOIA request letter based on the following details.

Agency: ${body.agency.trim()}
Subject: ${body.subject.trim()}
${body.description?.trim() ? `Description of records sought: ${body.description.trim()}` : ''}
Date: ${today}
Requester name: ${requester}
Requester address: ${address}

Requirements:
- Use correct formal letter format with date, recipient, salutation, body, and closing
- Cite the Freedom of Information Act (5 U.S.C. § 552) if federal, or the relevant state public records law if the agency is a state/local body
- Clearly describe the records being requested with sufficient specificity to allow a reasonable search
- Request a fee waiver on the basis that disclosure is in the public interest (journalism)
- Include a request for expedited processing if the subject is time-sensitive
- Set a reasonable 20-business-day response deadline for federal; adjust if state/local
- Keep the tone professional and direct

Return ONLY the letter text, starting with the date line. Do not add any preamble, commentary, or explanation.`

    const letter = await chat([{ role: 'user', content: prompt }], 0.3)

    return NextResponse.json({ letter })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
