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
  if (!report?.imagePath) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const fullPath = join(getReportsRoot(), report.imagePath)
    const buffer = readFileSync(fullPath)
    const ext = report.fileType.toLowerCase()
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
