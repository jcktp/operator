import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeReport, compareReports, checkResolvedFlags } from '@/lib/ai'

// ── Google link helpers ──────────────────────────────────────────────────────

function extractDocId(url: string): string | null {
  return url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? null
}

async function fetchGoogleContent(url: string): Promise<{ text: string; fileType: string; fileName: string }> {
  let exportUrl: string
  let fileType: string
  let fileName: string

  if (url.includes('docs.google.com/document')) {
    const id = extractDocId(url)
    if (!id) throw new Error('Could not extract document ID from URL')
    exportUrl = `https://docs.google.com/document/d/${id}/export?format=txt`
    fileType = 'txt'
    fileName = 'google-doc.txt'
  } else if (url.includes('docs.google.com/spreadsheets')) {
    const id = extractDocId(url)
    if (!id) throw new Error('Could not extract spreadsheet ID from URL')
    exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`
    fileType = 'csv'
    fileName = 'google-sheet.csv'
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

  const text = await res.text()
  return { text, fileType, fileName }
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { url, title, area, directReportId, reportDate } = await req.json()

    if (!url)   return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (!area)  return NextResponse.json({ error: 'Area is required' }, { status: 400 })

    let rawContent: string
    let fileType: string
    let fileName: string

    try {
      const result = await fetchGoogleContent(url)
      rawContent = result.text
      fileType = result.fileType
      fileName = result.fileName
    } catch (e) {
      return NextResponse.json({ error: String(e).replace('Error: ', '') }, { status: 422 })
    }

    if (!rawContent || rawContent.trim().length < 10) {
      return NextResponse.json({ error: 'Document appears to be empty or unreadable' }, { status: 422 })
    }

    // Apply saved AI provider settings
    const settings = await prisma.setting.findMany()
    for (const s of settings) {
      if (s.key === 'ollama_host')     process.env.OLLAMA_HOST = s.value
      if (s.key === 'ollama_model')    process.env.OLLAMA_MODEL = s.value
      if (s.key === 'ai_provider')     process.env.AI_PROVIDER = s.value
      if (s.key === 'anthropic_key')   process.env.ANTHROPIC_API_KEY = s.value
      if (s.key === 'openai_key')      process.env.OPENAI_API_KEY = s.value
      if (s.key === 'google_key')      process.env.GOOGLE_API_KEY = s.value
      if (s.key === 'groq_key')        process.env.GROQ_API_KEY = s.value
      if (s.key === 'anthropic_model') process.env.ANTHROPIC_MODEL = s.value
      if (s.key === 'openai_model')    process.env.OPENAI_MODEL = s.value
      if (s.key === 'google_model')    process.env.GOOGLE_MODEL = s.value
      if (s.key === 'groq_model')      process.env.GROQ_MODEL = s.value
    }

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
        summary: analysis?.summary ?? null,
        metrics: analysis?.metrics ? JSON.stringify(analysis.metrics) : null,
        insights: analysis?.insights ? JSON.stringify(analysis.insights) : null,
        questions: analysis?.questions ? JSON.stringify(analysis.questions) : null,
        comparison: comparison ? JSON.stringify(comparison) : null,
        resolvedFlags: resolvedFlagsJson,
        displayContent: null,
      },
      include: { directReport: true },
    })

    return NextResponse.json({ report, hasPrevious: !!previousReport })
  } catch (e) {
    console.error('Link upload error:', e)
    return NextResponse.json({ error: 'Failed to process link' }, { status: 500 })
  }
}
