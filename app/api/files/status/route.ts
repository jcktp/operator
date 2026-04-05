import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import type { FileStatus } from '@/lib/files-types'

export async function POST(req: Request) {
  const authError = await requireAuth(req)
  if (authError) return authError

  const { paths } = await req.json() as { paths: string[] }
  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ statuses: [] })
  }

  const reports = await prisma.report.findMany({
    where: { filePath: { in: paths } },
    select: { id: true, title: true, filePath: true, createdAt: true },
  })

  const map = new Map(reports.map(r => [r.filePath!, r]))

  const statuses: FileStatus[] = paths.map(p => {
    const r = map.get(p)
    if (r) {
      return { relativePath: p, analysed: true, analysedAt: r.createdAt.toISOString(), reportId: r.id, reportTitle: r.title }
    }
    return { relativePath: p, analysed: false }
  })

  return NextResponse.json({ statuses })
}
