import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeReport, compareReports, checkResolvedFlags } from '@/lib/ai'
import { loadAiSettings } from '@/lib/settings'
import { extractContent } from '@/lib/parsers'

// ── Google link helpers ──────────────────────────────────────────────────────

function extractDocId(url: string): string | null {
  return url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? null
}

async function fetchGoogleContent(url: string): Promise<{ text: string; displayContent?: string; fileType: string; fileName: string }> {
  let exportUrl: string
  let fileType: string
  let fileName: string
  let isSpreadsheet = false

  if (url.includes('docs.google.com/document')) {
    const id = extractDocId(url)
    if (!id) throw new Error('Could not extract document ID from URL')
    exportUrl = `https://docs.google.com/document/d/${id}/export?format=txt`
    fileType = 'txt'
    fileName = 'google-doc.txt'
  } else if (url.includes('docs.google.com/spreadsheets')) {
    const id = extractDocId(url)
    if (!id) throw new Error('Could not extract spreadsheet ID from URL')
    // Export as XLSX to capture all sheets with their names
    exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`
    fileType = 'xlsx'
    fileName = 'google-sheet.xlsx'
    isSpreadsheet = true
  } else if (url.includes('docs.google.com/presentation')) {
    const id = extractDocId(url)
    if (!id) throw new Error('Could not extract presentation ID from URL')
    exportUrl = `https://docs.google.com/presentation/d/${id}/export?format=txt`
    fileType = 'txt'
    fileName = 'google-slides.txt'
  } else {
    throw new Error('Unsupported link. Please use a Google Docs, Sheets, or Slides URL.')
  }

  const res = await fetch(exportUrl, { redirect: 'follow' })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Access denied. Make sure the document is shared as "Anyone with the link can view".')
    }
    throw new Error(`Could not fetch document (HTTP ${res.status}). Check that the link is correct and the document is publicly shared.`)
  }

  if (isSpreadsheet) {
    const buffer = Buffer.from(await res.arrayBuffer())
    const parsed = await extractContent(buffer, fileType)
    return { text: parsed.text, displayContent: parsed.displayContent, fileType, fileName }
  }

  const text = await res.text()
  return { text, fileType, fileName }
}

// ── Title fetch (GET /api/upload-link?url=...) ───────────────────────────────

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') ?? ''
  if (!url) return NextResponse.json({ title: '' })
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Operator/1.0)' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return NextResponse.json({ title: '' })
    const html = await res.text()
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (!match) return NextResponse.json({ title: '' })
    const raw = match[1]
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/ [-–—] Google (Docs|Sheets|Slides)$/i, '')
      .trim()
    return NextResponse.json({ title: raw })
  } catch {
    return NextResponse.json({ title: '' })
  }
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { url, title, area, directReportId, reportDate, storyName, projectId } = await req.json()

    if (!url)   return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (!area)  return NextResponse.json({ error: 'Area is required' }, { status: 400 })

    let rawContent: string
    let fileType: string
    let fileName: string
    let displayContent: string | null = null

    try {
      const result = await fetchGoogleContent(url)
      rawContent = result.text
      fileType = result.fileType
      fileName = result.fileName
      displayContent = result.displayContent ?? null
    } catch (e) {
      return NextResponse.json({ error: String(e).replace('Error: ', '') }, { status: 422 })
    }

    if (!rawContent || rawContent.trim().length < 10) {
      return NextResponse.json({ error: 'Document appears to be empty or unreadable' }, { status: 422 })
    }

    // Apply saved AI provider settings (uses proper decryption via loadAiSettings)
    await loadAiSettings()

    let directName: string | undefined
    if (directReportId) {
      const direct = await prisma.directReport.findUnique({ where: { id: directReportId } })
      if (direct) directName = direct.name
    }

    const previousReport = await prisma.report.findFirst({
      where: {
        area,
        ...(directReportId ? { directReportId } : {}),
        summary: { not: null },
        metrics: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    })

    let analysis = null
    try {
      analysis = await analyzeReport(rawContent, title, area, directName)
    } catch (e) {
      console.error('AI analysis failed:', e)
    }

    let comparison = null
    if (previousReport && analysis && previousReport.summary && previousReport.metrics) {
      try {
        comparison = await compareReports(
          previousReport.summary,
          previousReport.metrics,
          analysis.summary,
          JSON.stringify(analysis.metrics),
          area
        )
      } catch (e) {
        console.error('Comparison failed:', e)
      }
    }

    // Check which previous flags are now resolved
    let resolvedFlagsJson: string | null = null
    if (previousReport?.insights && analysis) {
      try {
        type PrevInsight = { type: string; text: string }
        const prevInsights: PrevInsight[] = JSON.parse(previousReport.insights)
        const prevFlags = prevInsights.filter(i => i.type === 'risk' || i.type === 'anomaly')
        if (prevFlags.length > 0) {
          const resolved = await checkResolvedFlags(prevFlags, rawContent, analysis.insights)
          if (resolved.length > 0) resolvedFlagsJson = JSON.stringify(resolved)
        }
      } catch (e) {
        console.error('Resolved flags check failed:', e)
      }
    }

    const report = await prisma.report.create({
      data: {
        title,
        fileName,
        fileType,
        fileSize: rawContent.length,
        rawContent,
        area,
        directReportId: directReportId || null,
        reportDate: reportDate ? new Date(reportDate) : null,
        storyName: storyName || null,
        projectId: projectId || null,
        summary: analysis?.summary ?? null,
        metrics: analysis?.metrics ? JSON.stringify(analysis.metrics) : null,
        insights: analysis?.insights ? JSON.stringify(analysis.insights) : null,
        questions: analysis?.questions ? JSON.stringify(analysis.questions) : null,
        comparison: comparison ? JSON.stringify(comparison) : null,
        resolvedFlags: resolvedFlagsJson,
        displayContent,
      },
      include: { directReport: true },
    })

    return NextResponse.json({ report, hasPrevious: !!previousReport })
  } catch (e) {
    console.error('Link upload error:', e)
    return NextResponse.json({ error: 'Failed to process link' }, { status: 500 })
  }
}
