import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getReportsRoot } from '@/lib/reports-folder'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getMimeType } from '@/lib/parsers'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const report = await prisma.report.findUnique({ where: { id } })
  // imagePath may be null for reports created before it was tracked —
  // fall back to extracting the path from displayContent ('image:area/filename')
  const imagePath = report?.imagePath
    ?? (report?.displayContent?.startsWith('image:') ? report.displayContent.slice('image:'.length) : null)
  if (!imagePath) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const fullPath = join(getReportsRoot(), imagePath)
    const buffer = readFileSync(fullPath)
    const ext = (report?.fileType ?? 'png').toLowerCase()
    const contentType = getMimeType(ext)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return new NextResponse('Image not found on disk', { status: 404 })
  }
}
