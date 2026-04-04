import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getReportsRoot } from '@/lib/reports-folder'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { requireAuth } from '@/lib/api-auth'

const MIME: Record<string, string> = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc:  'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:  'application/vnd.ms-excel',
  csv:  'text/csv',
  txt:  'text/plain',
  md:   'text/markdown',
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  const report = await prisma.report.findUnique({ where: { id }, select: { filePath: true, fileType: true, fileName: true } })
  if (!report?.filePath) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const root = getReportsRoot()
    const fullPath = resolve(join(root, report.filePath))
    // Guard against path traversal
    if (!fullPath.startsWith(resolve(root) + '/') && fullPath !== resolve(root)) {
      return new NextResponse('Forbidden', { status: 403 })
    }
    const buffer = readFileSync(fullPath)
    const ext = report.fileType.toLowerCase()
    const contentType = MIME[ext] ?? 'application/octet-stream'
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${report.fileName}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return new NextResponse('File not found on disk', { status: 404 })
  }
}
