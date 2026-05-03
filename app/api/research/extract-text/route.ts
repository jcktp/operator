import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export async function POST(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const formData = await req.formData()
  const file = formData.get('file') as Blob | null
  if (!file) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const name = ((file as File).name ?? 'file').toLowerCase()
  const ext = name.split('.').pop() ?? ''
  const buf = Buffer.from(await file.arrayBuffer())

  try {
    let text = ''

    if (ext === 'pdf') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('pdf-parse')
      const pdfParse: (buf: Buffer) => Promise<{ text: string }> = mod.default ?? mod
      const parsed = await pdfParse(buf)
      text = parsed.text
    } else if (ext === 'docx' || ext === 'doc') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer: buf })
      text = result.value
    } else {
      // Plain text: txt, md, csv, json, xml, etc.
      text = buf.toString('utf-8')
    }

    return NextResponse.json({ text: text.trim() })
  } catch (err) {
    return NextResponse.json(
      { error: `Could not extract text: ${(err as Error).message}` },
      { status: 422 },
    )
  }
}
