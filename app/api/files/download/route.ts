import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { resolveWithinRoot } from '@/lib/file-cleaner'
import { readFileSync } from 'fs'
import { basename, extname } from 'path'

export const dynamic = 'force-dynamic'

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc:  'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:  'application/vnd.ms-excel',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt:  'application/vnd.oasis.opendocument.text',
  ods:  'application/vnd.oasis.opendocument.spreadsheet',
  epub: 'application/epub+zip',
  zip:  'application/zip',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  gif:  'image/gif',
  webp: 'image/webp',
  tiff: 'image/tiff',
  tif:  'image/tiff',
  svg:  'image/svg+xml',
  mp3:  'audio/mpeg',
  mp4:  'video/mp4',
  wav:  'audio/wav',
  flac: 'audio/flac',
  ogg:  'audio/ogg',
}

function mimeForExt(filename: string): string {
  const ext = extname(filename).replace('.', '').toLowerCase()
  return MIME_MAP[ext] ?? 'application/octet-stream'
}

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const relativePath = req.nextUrl.searchParams.get('path')

  if (!relativePath) {
    return NextResponse.json({ error: 'path required' }, { status: 400 })
  }

  const guard = resolveWithinRoot(relativePath)
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: 403 })
  }

  try {
    const bytes = readFileSync(guard.abs)
    const name = basename(guard.abs)

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': mimeForExt(name),
        'Content-Disposition': `attachment; filename="${name}"`,
        'Content-Length': bytes.length.toString(),
      },
    })
  } catch (e) {
    console.error('[files/download] error:', e)
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 })
  }
}
