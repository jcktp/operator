import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { getReportsRoot } from '@/lib/reports-folder'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'

export interface ImagePoint {
  reportId: string
  title: string
  lat: number
  lon: number
  imagePath: string
  area: string
  dateTaken?: string
  camera?: string
}

const IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'tiff', 'tif'])

function isImage(fileType: string): boolean {
  return IMAGE_TYPES.has(fileType.toLowerCase().replace(/^\./, ''))
}

export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  }

  const reports = await prisma.report.findMany({
    where: { projectId },
    select: { id: true, title: true, fileType: true, imagePath: true, area: true },
  })

  const imageReports = reports.filter(r => r.imagePath && r.fileType && isImage(r.fileType))
  const totalImages = imageReports.length
  const root = getReportsRoot()
  const points: ImagePoint[] = []

  for (const report of imageReports) {
    if (!report.imagePath) continue
    const abs = resolve(join(root, report.imagePath))
    if (!abs.startsWith(resolve(root) + '/')) continue  // path traversal guard

    let buf: Buffer
    try {
      buf = readFileSync(abs)
    } catch {
      continue
    }

    try {
      const exifr = await import('exifr')
      const raw = await exifr.parse(buf, { gps: true, exif: true, tiff: true }).catch(() => null)
      if (!raw || raw.latitude == null || raw.longitude == null) continue

      const point: ImagePoint = {
        reportId: report.id,
        title: report.title,
        lat: raw.latitude,
        lon: raw.longitude,
        imagePath: report.imagePath,
        area: report.area,
      }
      if (raw.DateTimeOriginal) point.dateTaken = new Date(raw.DateTimeOriginal).toISOString()
      if (raw.Make || raw.Model) point.camera = [raw.Make, raw.Model].filter(Boolean).join(' ')
      points.push(point)
    } catch {
      continue
    }
  }

  return NextResponse.json({ points, totalImages })
}
