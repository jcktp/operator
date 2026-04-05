import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { extractContent, getFileType } from '@/lib/parsers'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileType = getFileType(file.name)
    const result = await extractContent(buffer, fileType)
    return NextResponse.json({ text: result.text.slice(0, 10000) })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
