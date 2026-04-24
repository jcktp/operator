import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { loadAiSettings } from '@/lib/settings'
import { chat } from '@/lib/ai-providers'
import { getModeConfig } from '@/lib/mode'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const projectId = req.nextUrl.searchParams.get('projectId') ?? undefined
  const digest = await prisma.digest.findFirst({
    where: projectId ? { projectId } : {},
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ digest })
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  await loadAiSettings()
  const body = await req.json() as { projectId?: string }
  const projectId = body.projectId ?? undefined

  // Fetch last digest to determine date range
  const lastDigest = await prisma.digest.findFirst({
    where: projectId ? { projectId } : {},
    orderBy: { createdAt: 'desc' },
  })
  const since = lastDigest?.createdAt ?? new Date(0)

  const reports = await prisma.report.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      createdAt: { gt: since },
    },
    select: { id: true, title: true, area: true, summary: true, tags: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  if (reports.length === 0) {
    return NextResponse.json({ error: 'No new documents since last digest' }, { status: 400 })
  }

  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  const modeConfig = getModeConfig(modeRow?.value)

  const reportSummaries = reports.map(r => {
    const tags = r.tags ? (() => { try { return JSON.parse(r.tags) as string[] } catch { return [] } })() : []
    return `- ${r.title} [${r.area}]${tags.length ? ` (tags: ${tags.join(', ')})` : ''}\n  ${r.summary ?? '(no summary)'}`
  }).join('\n')

  const prompt = `You are a ${modeConfig.label.toLowerCase()} intelligence assistant. Summarise what's new across these ${reports.length} ${modeConfig.documentLabelPlural.toLowerCase()}.

Documents:
${reportSummaries}

Write a structured digest with:
1. **Key Themes** — 3-5 major themes or topics across all documents
2. **Notable Changes** — any significant shifts, risks, or developments
3. **Action Items** — suggested follow-ups based on the content

Keep it concise — 200-300 words maximum. Write in markdown. Do NOT use JSON.`

  const content = await chat([{ role: 'user', content: prompt }], 0.3)

  const digest = await prisma.digest.create({
    data: {
      projectId: projectId ?? null,
      content,
      reportIds: JSON.stringify(reports.map(r => r.id)),
    },
  })

  return NextResponse.json({ digest }, { status: 201 })
}
